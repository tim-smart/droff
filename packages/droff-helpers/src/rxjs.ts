import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";

export const rateLimit =
  (limit: number, window: number) =>
  <T>(source$: Rx.Observable<T>) => {
    let remaining = limit;
    let timeout: NodeJS.Timeout | undefined;
    let resolve: (() => void) | undefined;

    const waitForToken = async () => {
      if (remaining === 0) {
        await new Promise<void>((r) => (resolve = r));
      }

      if (!timeout) {
        timeout = setTimeout(() => {
          remaining = limit;
          timeout = undefined;

          if (resolve) {
            resolve();
            resolve = undefined;
          }
        }, window);
      }

      remaining = remaining - 1;
    };

    return source$.pipe(
      RxO.concatMap((item) => waitForToken().then(() => item)),
    );
  };

export const groupByTime =
  (op: (time: number) => Rx.MonoTypeOperatorFunction<any>) =>
  (window: number) => {
    const operator = op(window);
    return <T>(key: (item: T) => string) =>
      (source$: Rx.Observable<T>): Rx.Observable<T> =>
        source$.pipe(
          RxO.groupBy(key, {
            duration: (group$) => group$.pipe(RxO.debounceTime(window * 2)),
          }),
          RxO.mergeMap((group$) => group$.pipe(operator)),
        );
  };

export const rateLimitBy = (
  /**
   * The maximum number of items to emit per `window` of time.
   */
  limit: number,
  /**
   * How often the rate limiter resets in milliseconds.
   *
   * If you wants to rate items 5 times per seconds, `limit` would by 5, and
   * `window` would be 1000.
   */
  window: number,
) => {
  const limiter = rateLimit(limit, window);
  return groupByTime(() => limiter)(window);
};

export const debounceBy = groupByTime(RxO.debounceTime);
export const throttleBy = groupByTime(RxO.throttleTime);
