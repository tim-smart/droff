import * as F from "fp-ts/function";
import { WebSocketClient } from "reconnecting-ws";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { RateLimitOp } from "../rate-limits/rxjs";
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

export function create(
  baseURL = "wss://gateway.discord.gg/",
  rateLimit: RateLimitOp,
) {
  const { encode, decode, encoding } = Codec.create();

  const ws = new WebSocketClient();
  ws.connect(`${baseURL}?v=${VERSION}&encoding=${encoding}`);

  const sendSubject = new Rx.Subject<GatewayPayload>();
  function send(data: GatewayPayload) {
    sendSubject.next(data);
  }
  sendSubject
    .pipe(
      rateLimit("gateway.send", 60500, 120),
      RxO.tap((payload) => ws.sendData(encode(payload))),
    )
    .subscribe();

  let manuallyClosed = false;
  function close() {
    sendSubject.complete();
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
