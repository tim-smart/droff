import {
  GatewayDispatchPayload,
  GatewayHeartbeatAck,
  GatewayHeartbeatRequest,
  GatewayHello,
  GatewayInvalidSession,
  GatewayOPCodes,
  GatewayReceivePayload,
  GatewayReconnect,
  GatewaySendPayload,
} from "discord-api-types/gateway/v8";
import * as Erl from "erlpack";
import * as F from "fp-ts/function";
import { WebSocketClient } from "reconnecting-ws";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";

export interface GatewayConnectionOptions {
  version: number;
}

const opCode = <T extends GatewayReceivePayload>(code: T["op"]) =>
  F.flow(
    RxO.filter((p: GatewayReceivePayload): p is T => p.op === code),
    RxO.share(),
  );

export function create({
  version = 9,
}: Partial<GatewayConnectionOptions> = {}) {
  const ws = new WebSocketClient();
  ws.connect(`wss://gateway.discord.gg/?v=${version}&encoding=etf`);

  function send(data: GatewaySendPayload) {
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

  const messageSubject = new Rx.Subject<GatewayReceivePayload>();
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

  const dispatch$ = raw$.pipe(
    opCode<GatewayDispatchPayload>(GatewayOPCodes.Dispatch),
  );
  const heartbeat$ = raw$.pipe(
    opCode<GatewayHeartbeatRequest>(GatewayOPCodes.Heartbeat),
  );
  const reconnect$ = raw$.pipe(
    opCode<GatewayReconnect>(GatewayOPCodes.Reconnect),
  );
  const invalidSession$ = raw$.pipe(
    opCode<GatewayInvalidSession>(GatewayOPCodes.InvalidSession),
  );
  const hello$ = raw$.pipe(opCode<GatewayHello>(GatewayOPCodes.Hello));
  const heartbeatAck$ = raw$.pipe(
    opCode<GatewayHeartbeatAck>(GatewayOPCodes.HeartbeatAck),
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
