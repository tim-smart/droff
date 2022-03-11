import * as F from "fp-ts/function";
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
    RxO.map((diff) => [diff, Date.now()] as const),
    RxO.pairwise(),
    RxO.filter(([[a], [b]]) => a === 1 && b === 0),
    RxO.map(([[, a], [, b]]) => b - a),
    RxO.scan((acc, ms) => {
      acc.push(ms);
      return acc.length > 5 ? acc.slice(1) : acc;
    }, [] as number[]),
    RxO.map((arr) => Math.round(arr.reduce((a, b) => a + b) / arr.length)),
    RxO.share(),
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

  const sharderHeartbeat$ = Rx.interval(60000).pipe(
    RxO.tap(() => sharderHeartbeat?.()),
  );

  const effects$ = Rx.merge(
    identifyEffects$,
    heartbeatEffects$,
    reconnectEffects$,
    sharderHeartbeat$,
  ).pipe(RxO.ignoreElements(), RxO.share());

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
  };
}

export type Shard = ReturnType<typeof create>;
