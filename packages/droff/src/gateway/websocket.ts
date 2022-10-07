import * as F from "fp-ts/function";
import WebSocket, { RawData } from "ws";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";

export const RECONNECT = Symbol();
export type Payload<T> = T | typeof RECONNECT;

export function create<Rx, Tx>(
  url: Rx.BehaviorSubject<string>,
  outgoing$: Rx.Observable<Payload<Tx>>,
  opts: { encode: (data: Tx) => RawData; decode: (data: RawData) => Rx } = {
    encode: F.identity as any,
    decode: F.identity as any,
  },
) {
  return new Rx.Observable<Rx>((s) => {
    let closed = false;

    const createWS = () => {
      const ws = new WebSocket(url.value);
      ws.binaryType = "arraybuffer";

      let sub: Rx.Subscription;

      ws.on("open", () => {
        sub = outgoing$.subscribe((payload) => {
          if (payload === RECONNECT) {
            ws.close(1012, "reconnecting");
            return;
          }

          ws.send(opts.encode(payload));
        });
      });

      ws.on("message", (data) => {
        s.next(opts.decode(data));
      });

      ws.on("error", () => {
        ws.close(1012, "reconnecting");
      });

      ws.on("close", (code, reason) => {
        ws.removeAllListeners();
        sub?.unsubscribe();
        if (closed) return;

        console.error(
          "[droff/gateway/websocket]",
          "[close]",
          code,
          reason.toString(),
        );
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
}
