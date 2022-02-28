import * as F from "fp-ts/function";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { RateLimitOp } from "../rate-limits/rxjs";
import { GatewayPayload } from "../types";
import * as Conn from "./connection";
import * as Dispatch from "./dispatch";
import * as Internal from "./internal";

export interface Options {
  token: string;
  intents: number;
  shard?: [number, number];
  baseURL?: string;

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
  shard = [0, 1],
  rateLimits: { op: rateLimitOp, sendLimit = 120, sendWindow = 60000 },
}: Options) {
  const conn = Conn.create(baseURL);

  const sendSubject = new Rx.Subject<GatewayPayload>();
  function send(payload: GatewayPayload) {
    sendSubject.next(payload);
  }
  sendSubject
    .pipe(rateLimitOp("gateway.send", sendWindow, sendLimit))
    .subscribe(conn.send);

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
    }),
    RxO.map(send),
  );

  // Heartbeats
  const [heartbeats$, heartbeatDiff$] = Internal.heartbeats$(
    conn,
    sequenceNumber$,
  );

  const heartbeatEffects$ = F.pipe(heartbeats$, RxO.map(send));

  // Reconnect when:
  // * heartbeats get out of sync
  // * reconnect is requested
  // * invalid session
  const reconnectEffects$ = Rx.merge(
    heartbeatDiff$.pipe(RxO.filter((diff) => diff > 1)),
    conn.reconnect$,
    conn.invalidSession$,
  ).pipe(
    RxO.map(() => {
      conn.reconnect();
    }),
  );

  const effects$ = Rx.merge(
    identifyEffects$,
    heartbeatEffects$,
    reconnectEffects$,
  ).pipe(
    RxO.finalize(() => {
      sendSubject.complete();
    }),
    RxO.share(),
  );

  return {
    id: shard,
    conn,
    send,
    raw$: conn.raw$,
    dispatch$: conn.dispatch$,
    ready$: latestReady$,
    effects$,
    reconnect: () => conn.reconnect(),
  };
}

export type Shard = ReturnType<typeof create>;
