import * as F from "fp-ts/function";
import { performance } from "perf_hooks";
import { QueueingSubject } from "queueing-subject";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { RateLimitOp } from "../rate-limits/rxjs";
import { GatewayPayload, UpdatePresence } from "../types";
import * as Conn from "./connection";
import * as Dispatch from "./dispatch";
import * as Internal from "./internal";
import { RECONNECT } from "./websocket";

export interface Options {
  token: string;
  intents: number;
  shard?: [number, number];
  baseURL?: string;
  sharderHeartbeat?: () => void;

  presence?: UpdatePresence;

  rateLimits: {
    op: RateLimitOp;
    sendLimit?: number;
    sendWindow?: number;
  };
}

export function create({
  token,
  baseURL,
  intents,
  sharderHeartbeat,
  shard = [0, 1],
  rateLimits: { op: rateLimitOp, sendLimit = 120, sendWindow = 60000 },
  presence,
}: Options) {
  const sendSubject = new QueueingSubject<Conn.ConnectionPayload>();

  function send(payload: GatewayPayload) {
    sendSubject.next(payload);
  }
  function reconnect() {
    sendSubject.next(RECONNECT);
  }

  const outgoing$ = sendSubject.pipe(
    rateLimitOp("gateway.send", sendWindow, sendLimit),
    RxO.share(),
  );

  const conn = Conn.create(outgoing$, baseURL);

  const fromDispatch = Dispatch.listen(conn.dispatch$);
  const sequenceNumber$ = Internal.latestSequenceNumber(conn.dispatch$);
  const latestReady$ = Internal.latestReady(fromDispatch, conn.invalidSession$);

  // Identify
  const identifyEffects$ = F.pipe(
    Internal.identify$({
      token,
      conn,
      shard,
      intents,
      latestReady: latestReady$,
      latestSequence: sequenceNumber$,
      presence,
    }),
    RxO.tap(send),
  );

  // Heartbeats
  const [heartbeats$, heartbeatDiff$] = Internal.heartbeats$(
    conn,
    sequenceNumber$,
  );

  const latency$ = heartbeatDiff$.pipe(
    RxO.map((diff) => [diff, performance.now()] as const),
    RxO.pairwise(),
    RxO.filter(([[a], [b]]) => a === 1 && b === 0),
    RxO.map(([[, a], [, b]]) => b - a),
    RxO.scan((acc, ms) => {
      acc.push(ms);
      return acc.length > 5 ? acc.slice(1) : acc;
    }, [] as number[]),
    RxO.map((arr) => Math.round(arr.reduce((a, b) => a + b) / arr.length)),
    RxO.shareReplay({ bufferSize: 1, refCount: true }),
  );

  const heartbeatEffects$ = F.pipe(heartbeats$, RxO.tap(send));

  // Reconnect when:
  // * heartbeats get out of sync
  // * reconnect is requested
  // * invalid session
  const reconnectEffects$ = Rx.merge(
    heartbeatDiff$.pipe(RxO.filter((diff) => diff > 1)),
    conn.reconnect$,
    conn.invalidSession$,
  ).pipe(RxO.tap(reconnect));

  const sharderHeartbeat$ = sharderHeartbeat
    ? Rx.interval(60000).pipe(RxO.tap(sharderHeartbeat))
    : Rx.EMPTY;

  // Resume URL
  const resumeUrlEffect$ = fromDispatch("READY").pipe(
    RxO.tap((ready) => {
      conn.setBaseUrl(ready.resume_gateway_url);
    }),
  );

  const effects$ = Rx.merge(
    identifyEffects$,
    heartbeatEffects$,
    reconnectEffects$,
    sharderHeartbeat$,
    resumeUrlEffect$,
  ).pipe(RxO.ignoreElements(), RxO.share());

  const debug$ = Rx.merge(
    outgoing$.pipe(RxO.tap((p) => console.error("[GATEWAY] [TX]", p))),
    latency$.pipe(
      RxO.tap((ms) =>
        console.error(`[GATEWAY] [LATENCY] [SHARD-${shard.join("-")}] ${ms}ms`),
      ),
    ),
  ).pipe(RxO.ignoreElements());

  return {
    id: shard,
    conn,
    send,
    reconnect,
    raw$: conn.raw$,
    dispatch$: conn.dispatch$,
    ready$: latestReady$,
    latency$,
    effects$,
    debug$,
  };
}

export type Shard = ReturnType<typeof create>;
