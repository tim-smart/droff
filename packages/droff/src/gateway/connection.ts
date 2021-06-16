import * as F from "fp-ts/function";
import { WebSocketClient } from "reconnecting-ws";
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

const opCode = <T = any>(code: GatewayOpcode) =>
  F.flow(
    RxO.filter((p: GatewayPayload<T>) => p.op === code),
    RxO.share(),
  );

export function create(baseURL = "wss://gateway.discord.gg/") {
  const { encode, decode, encoding } = Codec.create();

  const ws = new WebSocketClient();
  ws.connect(`${baseURL}?v=${VERSION}&encoding=${encoding}`);

  function send(data: GatewayPayload) {
    ws.sendData(encode(data));
  }

  let manuallyClosed = false;
  function close() {
    ws.disconnect();
    manuallyClosed = true;
  }

  function reconnect() {
    ws.WebSocketInstance.close(1012, "reconnecting");
  }

  const messageSubject = new Rx.Subject<GatewayPayload>();
  const raw$ = messageSubject.asObservable();
  ws.on("message", (data) => {
    messageSubject.next(decode(data as Buffer) as GatewayPayload);
  });

  ws.on("close", () => {
    if (!manuallyClosed) return;
    messageSubject.complete();
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
    send,
    close,
    reconnect,
  };
}

export type Connection = ReturnType<typeof create>;
