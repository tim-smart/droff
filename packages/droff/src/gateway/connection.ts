import * as F from "fp-ts/function";
import * as WS from "./websocket";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import {
  GatewayEvent,
  GatewayOpcode,
  GatewayPayload,
  Heartbeat,
  HelloEvent,
  InvalidSessionEvent,
} from "../types";
import * as Codec from "./codec";

const VERSION = 9;

export const opCode = <T = any>(code: GatewayOpcode) =>
  F.flow(
    RxO.filter((p: GatewayPayload<T>) => p.op === code),
    RxO.share(),
  );

export type ConnectionPayload = WS.Payload<GatewayPayload>;

export function create(
  outgoing$: Rx.Observable<ConnectionPayload>,
  baseURL = "wss://gateway.discord.gg/",
) {
  const { encode, decode, encoding } = Codec.create();
  const url = `${baseURL}?v=${VERSION}&encoding=${encoding}`;

  const raw$ = WS.create<GatewayPayload, GatewayPayload>(url, outgoing$, {
    encode,
    decode,
  });
  const dispatch$ = raw$.pipe(opCode<GatewayEvent>(GatewayOpcode.DISPATCH));
  const heartbeat$ = raw$.pipe(opCode<Heartbeat>(GatewayOpcode.HEARTBEAT));
  const reconnect$ = raw$.pipe(opCode(GatewayOpcode.RECONNECT));
  const invalidSession$ = raw$.pipe(
    opCode<InvalidSessionEvent>(GatewayOpcode.INVALID_SESSION),
  );
  const hello$ = raw$.pipe(opCode<HelloEvent>(GatewayOpcode.HELLO));
  const heartbeatAck$ = raw$.pipe(
    opCode<undefined>(GatewayOpcode.HEARTBEAT_ACK),
  );

  return {
    raw$,
    dispatch$,
    heartbeat$,
    reconnect$,
    invalidSession$,
    hello$,
    heartbeatAck$,
  };
}

export type Connection = ReturnType<typeof create>;
