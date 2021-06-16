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
  rateLimit: RateLimitOp;
  shard?: [number, number];
  baseURL?: string;
}

export function create({
  token,
  baseURL,
  intents,
  shard = [0, 1],
  rateLimit,
}: Options) {
  const conn = Conn.create(baseURL);

  const sendSubject = new Rx.Subject<GatewayPayload>();
  function send(payload: GatewayPayload) {
    sendSubject.next(payload);
  }
  sendSubject.pipe(rateLimit("gateway.send", 60500, 120)).subscribe(conn.send);

  const fromDispatch = Dispatch.listen(conn.dispatch$);
  const sequenceNumber$ = Internal.latestSequenceNumber(conn.dispatch$);
  const latestReady$ = Internal.latestReady(fromDispatch, conn.invalidSession$);

  // Identify
  const identifyEffects$ = F.pipe(
    Internal.identify$(
      conn,
      latestReady$,
      sequenceNumber$,
    )(token, {
      intents,
      shard,
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
