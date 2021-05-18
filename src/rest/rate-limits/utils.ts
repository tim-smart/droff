import { AxiosRequestConfig } from "axios";
import * as F from "fp-ts/function";
import { sequenceT } from "fp-ts/lib/Apply";
import * as O from "fp-ts/Option";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";

export const routeFromConfig = ({ url, method }: AxiosRequestConfig) => {
  if (!url) return "";

  // Only keep major ID's
  const routeURL = url.replace(/(?<!^)(\/[A-Za-z]+\/)\d{16,19}/g, "$1");

  return `${method}-${routeURL}`;
};

export const numberHeader = (headers: any) => (key: string) =>
  F.pipe(
    O.fromNullable(headers[key]),
    O.chainNullableK((val) => parseInt(val, 10)),
  );

export const rateLimitFromHeaders = (headers: any) =>
  F.pipe(
    sequenceT(O.Apply)(
      numberHeader(headers)("x-ratelimit-reset-after"),
      numberHeader(headers)("x-ratelimit-limit"),
      numberHeader(headers)("x-ratelimit-remaining"),
      O.fromNullable(headers["x-ratelimit-bucket"] as string),
    ),
    O.map(([resetAfter, limit, remaining, bucket]) => ({
      bucket,
      resetAfter: resetAfter * 1000,
      limit,
      remaining,
    })),
  );
export type RateLimitDetails = ReturnType<typeof rateLimitFromHeaders>;

export const retryAfter = (headers: any) =>
  F.pipe(
    O.fromNullable(headers["x-ratelimit-reset-after"]),
    O.chainNullableK((seconds) => parseInt(seconds, 10)),
    O.map((secs) => secs * 1000),
  );

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

  return <T>(key: (item: T) => string) =>
    (source$: Rx.Observable<T>) =>
      source$.pipe(
        RxO.groupBy(key, undefined, (group$) =>
          group$.pipe(RxO.debounceTime(window * 1.5)),
        ),
        RxO.mergeMap((group$) => group$.pipe(limiter)),
      );
};
