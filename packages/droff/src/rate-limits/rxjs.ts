import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as Store from "./store";

export const rateLimit = (store: Store.Store) => {
  const waitOp = Store.maybeWait(store);
  return (key: string, window: number, limit: number) => {
    const wait = waitOp(key, window, limit);
    return <T>(source$: Rx.Observable<T>) =>
      source$.pipe(RxO.concatMap((item) => wait().then(() => item)));
  };
};

export type RateLimitOp = ReturnType<typeof rateLimit>;
