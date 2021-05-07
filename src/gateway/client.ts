import * as F from "fp-ts/function";
import * as RxO from "rxjs/operators";
import * as Conn from "./connection";
import * as Internal from "./internal";
import * as Dispatch from "./dispatch";
import * as O from "fp-ts/Option";
import { GatewayDispatchEvents } from "discord-api-types/gateway/v8";

export interface Options {
  token: string;
  intents: number;
  shard?: [number, number];
}

export function create({ token, intents, shard = [0, 1] }: Options) {
  const conn = Conn.create();

  const dispatch$ = Dispatch.listen$(conn.dispatch$);
  const sequenceNumber = Internal.latestSequenceNumber(conn.dispatch$);
  const latestReady = Dispatch.latest$(dispatch$, GatewayDispatchEvents.Ready);

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
  F.pipe(
    Internal.heartbeats$(conn, sequenceNumber),
    RxO.tap((p) => conn.send(p)),
  ).subscribe({
    // Error when ACK isn't recieved
    error: () => conn.reconnect(),
  });

  // Reconnects
  conn.reconnect$.subscribe(() => {
    conn.reconnect();
  });

  // Invalid session
  conn.invalidSession$.subscribe((data) => {
    // Removing the latest ready state forces a new identify
    if (!data.d) {
      latestReady.next(O.none);
    }
    conn.reconnect();
  });

  return {
    conn,
    send: conn.send,
    raw$: conn.raw$,
    dispatch$,
    close: () => conn.close(),
    reconnect: () => conn.reconnect(),
  };
}

export type Client = ReturnType<typeof create>;
