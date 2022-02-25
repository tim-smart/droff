import * as F from "fp-ts/function";
import WebSocket from "ws";
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

  const url = `${baseURL}?v=${VERSION}&encoding=${encoding}`;
  const messageSubject = new Rx.Subject<GatewayPayload>();
  const raw$: Rx.Observable<GatewayPayload> = messageSubject;

  const createWS = () => {
    const ws = new WebSocket(url, { perMessageDeflate: false });

    ws.on("message", (data) => {
      messageSubject.next(decode(data as Buffer) as GatewayPayload);
    });

    ws.on("error", () => {
      ws.close(1012, "reconnecting");
    });

    ws.on("close", () => {
      if (!manuallyClosed) {
        return replaceWS();
      }

      messageSubject.complete();
    });

    return ws;
  };

  let ws = createWS();

  const replaceWS = () => {
    ws.removeAllListeners();
    ws = createWS();
  };

  function send(data: GatewayPayload) {
    ws.send(encode(data));
  }

  let manuallyClosed = false;
  function close() {
    ws.close();
    manuallyClosed = true;
  }

  function reconnect() {
    ws.close(1012, "reconnecting");
  }

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
