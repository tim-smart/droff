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

export const opCode = <T = any>(code: GatewayOpcode) =>
  F.flow(
    RxO.filter((p: GatewayPayload<T>) => p.op === code),
    RxO.share(),
  );

export const RECONNECT = Symbol();
export type ConnectionPayload = GatewayPayload | typeof RECONNECT;

export function create(
  input$: Rx.Observable<ConnectionPayload>,
  baseURL = "wss://gateway.discord.gg/",
) {
  const { encode, decode, encoding } = Codec.create();
  const url = `${baseURL}?v=${VERSION}&encoding=${encoding}`;

  const raw$ = new Rx.Observable<GatewayPayload>((s) => {
    let closed = false;

    const createWS = () => {
      const ws = new WebSocket(url);
      let sub: Rx.Subscription;

      ws.on("open", () => {
        sub = input$.subscribe((payload) => {
          if (payload === RECONNECT) {
            ws.close(1012, "reconnecting");
            return;
          }

          ws.send(encode(payload));
        });
      });

      ws.on("message", (data) => {
        s.next(decode(data as Buffer) as GatewayPayload);
      });

      ws.on("error", () => {
        ws.close(1012, "reconnecting");
      });

      ws.on("close", () => {
        ws.removeAllListeners();
        sub?.unsubscribe();
        if (closed) return;
        replaceWS();
      });

      return ws;
    };

    const replaceWS = () => {
      ws = createWS();
    };

    // Start the websocket
    let ws = createWS();

    return () => {
      closed = true;
      ws.close();
    };
  }).pipe(RxO.share());

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
