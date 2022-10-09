import * as F from "fp-ts/function";
import * as WS from "./websocket";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import {
  ReceiveEvent,
  GatewayOpcode,
  GatewayPayload,
  Heartbeat,
  HelloEvent,
  InvalidSessionEvent,
} from "../types";
import * as Codec from "./codec";

const VERSION = 10;

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

  const createUrl = (baseUrl: string) => {
    const url = new URL(baseUrl);
    url.searchParams.set("v", VERSION.toString());
    url.searchParams.set("encoding", encoding);
    return url;
  };

  const url = new Rx.BehaviorSubject(createUrl(baseURL));
  const setBaseUrl = (baseUrl: string) => url.next(createUrl(baseUrl));

  const raw$ = WS.create<GatewayPayload, GatewayPayload>(url, outgoing$, {
    encode,
    decode,
  });
  const dispatch$ = raw$.pipe(opCode<ReceiveEvent>(GatewayOpcode.DISPATCH));
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
    setBaseUrl,
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
