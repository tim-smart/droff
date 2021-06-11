import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as Store from "./store";

export const rateLimit =
  (store: Store.Store) =>
  (key: string, window: number, limit: number) =>
  <T>(source$: Rx.Observable<T>) =>
    source$.pipe(
      RxO.concatMap((item) => store.wait(key, window, limit).then(() => item)),
    );

export type RateLimitOp = ReturnType<typeof rateLimit>;
