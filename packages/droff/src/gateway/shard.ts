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
  sharderHeartbeat?: () => void;

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
}: Options) {
  const conn = Conn.create(baseURL);

  let sendSubject: Rx.Subject<GatewayPayload> | undefined;
  function send(payload: GatewayPayload) {
    if (!sendSubject) return;
    sendSubject.next(payload);
  }
  const sendEffects$ = new Rx.Observable<void>(() => {
    sendSubject = new Rx.Subject();

    sendSubject
      .pipe(rateLimitOp("gateway.send", sendWindow, sendLimit))
      .subscribe(conn.send);

    return () => {
      sendSubject!.complete();
    };
  });

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
    RxO.tap(send),
  );

  // Heartbeats
  const [heartbeats$, heartbeatDiff$] = Internal.heartbeats$(
    conn,
    sequenceNumber$,
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
  ).pipe(RxO.tap(conn.reconnect));

  const sharderHeartbeat$ = Rx.interval(30000).pipe(
    RxO.tap(() => sharderHeartbeat?.()),
  );

  const effects$ = Rx.merge(
    sendEffects$,
    identifyEffects$,
    heartbeatEffects$,
    reconnectEffects$,
    sharderHeartbeat$,
  ).pipe(RxO.ignoreElements(), RxO.share());

  return {
    id: shard,
    conn,
    send,
    reconnect: conn.reconnect,
    raw$: conn.raw$,
    dispatch$: conn.dispatch$,
    ready$: latestReady$,
    effects$,
  };
}

export type Shard = ReturnType<typeof create>;
