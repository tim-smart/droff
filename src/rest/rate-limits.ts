import {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { rateLimit } from "rxjs-ratelimit-operator";
import * as F from "fp-ts/function";
import * as O from "fp-ts/Option";
import { sequenceT } from "fp-ts/lib/Apply";

const routeFromConfig = ({ url, method }: AxiosRequestConfig) =>
  `${method}-${url}`;

const numberHeader = (headers: any) => (key: string) =>
  F.pipe(
    O.fromNullable(headers[key]),
    O.chainNullableK((val) => parseInt(val, 10)),
  );

const rateLimitFromHeaders = (headers: any) =>
  F.pipe(
    sequenceT(O.Apply)(
      numberHeader(headers)("x-ratelimit-reset-after"),
      numberHeader(headers)("x-ratelimit-limit"),
      numberHeader(headers)("x-ratelimit-remaining"),
      O.fromNullable(headers["x-ratelimit-bucket"]),
    ),
    O.map(([resetAfter, limit, remaining, bucket]) => {
      const perRequest = resetAfter / (remaining + 1);
      const window = Math.ceil(limit * perRequest * 1000);

      return {
        bucket,
        window,
        limit,
      };
    }),
  );

const retryAfter = (headers: any) =>
  F.pipe(
    O.fromNullable(headers["x-ratelimit-reset-after"]),
    O.chainNullableK((seconds) => parseInt(seconds, 10)),
    O.map((secs) => secs * 1000),
  );

export const interceptors =
  (limit: number, window: number) => (axios: AxiosInstance) => {
    const queue = new Rx.Subject<[AxiosRequestConfig, () => void]>();
    const routeToBucket = new Map<string, string | undefined>();
    const bucketDetails = new Map<
      string,
      {
        limit: number;
        window: number;
      }
    >();

    function request(opts: AxiosRequestConfig): Promise<AxiosRequestConfig> {
      return new Promise((resolve) => {
        queue.next([opts, () => resolve(opts)]);
      });
    }

    async function response(res: AxiosResponse) {
      const route = routeFromConfig(res.config);

      // If we already have processed this route, then short circuit.
      if (routeToBucket.has(route)) return res;

      // Try extract bucket details from headers
      F.pipe(
        rateLimitFromHeaders(res.headers),
        O.map(({ bucket, window, limit }) => {
          routeToBucket.set(route, bucket);
          if (!bucketDetails.has(bucket)) {
            bucketDetails.set(bucket, { window, limit });
          }
        }),
      );

      return res;
    }

    function error(err: AxiosError) {
      if (!err.response) return Promise.reject(err);
      // Try extract bucket details just in case
      response(err.response);

      if (err.response.status !== 429) return Promise.reject(err);
      return F.pipe(
        retryAfter(err.response.headers),
        O.fold(
          () => Promise.reject(err),
          (retryMs) =>
            new Promise((r) => setTimeout(r, retryMs)).then(() =>
              axios.request(err.config),
            ),
        ),
      );
    }

    queue
      .pipe(
        // Global rate limit
        rateLimit(limit, window),

        // Group by bucket
        RxO.groupBy(([opts, _resolve]) => {
          const route = routeFromConfig(opts);
          return routeToBucket.get(route);
        }),

        // Depending on the bucket, apply an additional rate limit
        RxO.flatMap((requests$) =>
          F.pipe(
            O.fromNullable(bucketDetails.get(requests$.key!)),
            O.fold(
              // No bucket, pass-through
              () => requests$,
              // We have bucket details, apply rate limit
              ({ window, limit }) => requests$.pipe(rateLimit(limit, window)),
            ),
          ),
        ),

        // Trigger the request
        RxO.tap(([_, resolve]) => resolve()),
      )
      .subscribe();

    return {
      request,
      response,
      error,
      complete: () => queue.complete(),
    };
  };
