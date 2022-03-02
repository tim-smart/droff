import * as F from "fp-ts/function";
import WebSocket, { RawData } from "ws";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";

export const RECONNECT = Symbol();
export type Payload<T> = T | typeof RECONNECT;

export function create<R, T>(
  url: string,
  input$: Rx.Observable<Payload<T>>,
  opts: { encode: (data: T) => RawData; decode: (data: RawData) => R } = {
    encode: F.identity as any,
    decode: F.identity as any,
  },
) {
  return new Rx.Observable<R>((s) => {
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

          ws.send(opts.encode(payload));
        });
      });

      ws.on("message", (data) => {
        s.next(opts.decode(data));
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
}
