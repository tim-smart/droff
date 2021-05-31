import * as Erl from "erlpack";
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
  ReconnectEvent,
} from "../types";

const VERSION = 8;

const opCode = <T = any>(code: GatewayOpcode) =>
  F.flow(
    RxO.filter((p: GatewayPayload<T>) => p.op === code),
    RxO.share(),
  );

export function create() {
  const ws = new WebSocketClient();
  ws.connect(`wss://gateway.discord.gg/?v=${VERSION}&encoding=etf`);

  function send(data: GatewayPayload) {
    return ws.sendData(Erl.pack(data));
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
    messageSubject.next(Erl.unpack(data as Buffer));
  });

  ws.on("close", (code, reason) => {
    if (!manuallyClosed) return;

    if (code === 1000) {
      messageSubject.complete();
    } else {
      messageSubject.error(F.tuple(code, reason));
    }
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
