import * as F from "fp-ts/function";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as Conn from "./connection";
import * as Dispatch from "./dispatch";
import * as Internal from "./internal";

export interface Options {
  token: string;
  intents: number;
  shard?: [number, number];
}

export function create({ token, intents, shard = [0, 1] }: Options) {
  const conn = Conn.create();

  const dispatch$ = Dispatch.listen$(conn.dispatch$);
  const sequenceNumber = Internal.latestSequenceNumber(conn.dispatch$);
  const latestReady = Internal.latestReady(dispatch$, conn.invalidSession$);

  // Identify
  F.pipe(
    Internal.identify$(
      conn,
      latestReady,
      sequenceNumber,
    )(token, {
      intents,
      shard,
    }),
    RxO.tap((p) => conn.send(p)),
  ).subscribe();

  // Heartbeats
  const [heartbeats$, heartbeatDiff$] = Internal.heartbeats$(
    conn,
    sequenceNumber,
  );

  F.pipe(
    heartbeats$,
    RxO.tap((p) => conn.send(p)),
  ).subscribe();

  // Reconnect when:
  // * heartbeats get out of sync
  // * reconnect is requested
  // * invalid session
  Rx.merge(
    heartbeatDiff$.pipe(RxO.filter((diff) => diff > 1)),
    conn.reconnect$,
    conn.invalidSession$,
  ).subscribe(() => {
    conn.reconnect();
  });

  return {
    conn,
    send: conn.send,
    raw$: conn.raw$,
    dispatch$: conn.dispatch$,
    close: () => conn.close(),
    reconnect: () => conn.reconnect(),
  };
}

export type Shard = ReturnType<typeof create>;
