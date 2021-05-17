import {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";
import * as F from "fp-ts/function";
import { sequenceT } from "fp-ts/lib/Apply";
import * as O from "fp-ts/Option";
import * as Im from "immutable";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";

const debugTap =
  (enabled: boolean) =>
  <T>(fn: (data: T) => void) =>
  (source$: Rx.Observable<T>) =>
    enabled ? source$.pipe(RxO.tap(fn)) : source$;

const routeFromConfig = ({ url, method }: AxiosRequestConfig) => {
  if (!url) return "";

  // Only keep major ID's
  const routeURL = url.replace(/(?<!^)(\/[A-Za-z]+\/)\d{16,19}/g, "$1");

  return `${method}-${routeURL}`;
};

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
      O.fromNullable(headers["x-ratelimit-bucket"] as string),
    ),
    O.map(([resetAfter, limit, bucket]) => ({
      bucket,
      resetAfter: resetAfter * 1000,
      limit,
    })),
  );

const retryAfter = (headers: any) =>
  F.pipe(
    O.fromNullable(headers["x-ratelimit-reset-after"]),
    O.chainNullableK((seconds) => parseInt(seconds, 10)),
    O.map((secs) => secs * 1000),
  );

type RateLimitDetails = ReturnType<typeof rateLimitFromHeaders>;

/** "request", route, config, resolve */
type RequestOp = readonly ["request", string, AxiosRequestConfig, () => void];

/** "response", route, rate limit */
type ResponseOp = readonly ["response", string, RateLimitDetails];

type InterceptorOp = RequestOp | ResponseOp;

export const interceptors =
  (limit: number, window: number, debug = false) =>
  (axios: AxiosInstance) => {
    const routeToBucket = new Map<string, string>();
    const bucketToRoutes = new Map<string, Set<string>>();
    const resets = new Set<string>();

    const ops = new Rx.Subject<InterceptorOp>();
    const sentRequests = new Rx.Subject<RequestOp>();
    const routeTimeouts = new Rx.Subject<string>();
    const whenDebug = debugTap(debug);

    // Keep track of global rate limit
    const globalCount$ = Rx.merge(
      Rx.of(0),
      sentRequests.pipe(RxO.map(() => -1)),
      Rx.interval(window).pipe(RxO.map(() => "reset" as const)),
    ).pipe(
      RxO.scan(
        (remaining, diff) => (diff === "reset" ? limit : remaining + diff),
        limit,
      ),
      RxO.distinctUntilChanged(),
      RxO.shareReplay(1),
    );

    // Interceptor handlers
    function request(opts: AxiosRequestConfig): Promise<AxiosRequestConfig> {
      return new Promise((resolve) => {
        ops.next([
          "request",
          routeFromConfig(opts),
          opts,
          () => resolve(opts),
        ] as const);
      });
    }

    function response(res: AxiosResponse) {
      const route = routeFromConfig(res.config);
      ops.next(["response", route, rateLimitFromHeaders(res.headers)] as const);
      return res;
    }

    function error(err: AxiosError) {
      if (debug) {
        console.error(
          "[RATE-LIMITS]",
          "[Axios error]",
          err.code,
          err.response?.status,
          err.config.url,
        );
      }

      if (!err.response) return Promise.reject(err);
      // Try extract bucket details just in case
      response(err.response);

      // Timeout?
      if (err.code === "ECONNABORTED") {
        routeTimeouts.next(routeFromConfig(err.config));
        return Promise.reject(err);
      }

      // Maybe attempt retry
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

    const requests$ = ops.pipe(
      RxO.filter((op): op is RequestOp => op[0] === "request"),
    );
    const responses$ = ops.pipe(
      RxO.filter((op): op is ResponseOp => op[0] === "response"),
    );
    const rateLimits$ = responses$.pipe(
      RxO.flatMap(([_op, route, rateLimit]) =>
        F.pipe(
          rateLimit,
          O.fold(
            () => Rx.EMPTY,
            (rateLimit) => Rx.of([route, rateLimit] as const),
          ),
        ),
      ),
      RxO.share(),
    );
    const resets$ = rateLimits$.pipe(
      RxO.filter(([_route, { bucket }]) => !resets.has(bucket)),
      RxO.map(([_route, rateLimit]) => rateLimit),
      RxO.tap(({ bucket }) => resets.add(bucket)),
    );

    // Rate limited route discovery
    const routeDiscovery$ = rateLimits$.pipe(
      RxO.filter(([route]) => !routeToBucket.has(route)),

      RxO.tap(([route, { bucket }]) => {
        routeToBucket.set(route, bucket);
        if (!bucketToRoutes.has(bucket)) {
          bucketToRoutes.set(bucket, new Set());
        }
        bucketToRoutes.get(bucket)!.add(route);
      }),

      whenDebug((d) => console.error("[RATE-LIMITS]", "[routeDiscovery$]", d)),
    );

    const routeCounters$ = sentRequests.pipe(
      RxO.scan(
        (counts, [_op, route]) => counts.update(route, 0, (count) => count - 1),
        Im.Map<string, number>(),
      ),
      RxO.shareReplay(1),
    );

    const bucketCounters$ = Rx.merge(
      routeDiscovery$.pipe(
        RxO.withLatestFrom(routeCounters$),
        RxO.map(
          ([[route, { bucket }], routeCounts]) =>
            ["new-route", bucket, routeCounts.get(route, 0)] as const,
        ),
      ),
      sentRequests.pipe(
        RxO.flatMap(([_op, route]) =>
          F.pipe(
            O.fromNullable(routeToBucket.get(route)),
            O.fold(
              () => Rx.EMPTY,
              (bucket) => Rx.of(["request", bucket] as const),
            ),
          ),
        ),
      ),
      resets$.pipe(
        RxO.flatMap(({ bucket, resetAfter, limit }) =>
          Rx.timer(resetAfter * 1.1).pipe(
            RxO.tap(() => resets.delete(bucket)),
            RxO.map(() => ["reset", bucket, limit] as const),
          ),
        ),
      ),
      routeTimeouts.pipe(
        RxO.flatMap(([_op, route]) =>
          F.pipe(
            O.fromNullable(routeToBucket.get(route)),
            O.fold(
              () => Rx.EMPTY,
              (bucket) => Rx.of(["timeout", bucket] as const),
            ),
          ),
        ),
      ),
    ).pipe(
      whenDebug((op) =>
        console.error("[RATE-LIMITS]", "bucketCounters$ op", op),
      ),
      RxO.scan((counts, op) => {
        switch (op[0]) {
          case "new-route":
            return counts.update(op[1], 0, (value) => value + op[2]);
          case "reset":
            return counts.set(op[1], op[2]);
          case "request":
            return counts.update(op[1], 0, (value) => value - 1);
          case "timeout":
            return counts.delete(op[1]);
        }
      }, Im.Map<string, number>()),
      RxO.shareReplay(1),
    );

    // Trigger requests
    const triggerRequests$ = requests$.pipe(
      // If part of a bucket, wait until we have a positive bucket count
      RxO.concatMap((request) => {
        const [_, route] = request;
        const bucket = routeToBucket.get(route);
        if (!bucket) return Rx.of(request);

        return bucketCounters$.pipe(
          RxO.map((counts) => counts.get(bucket, Infinity)),
          RxO.first((count) => count > 0),
          RxO.map(() => request),
        );
      }),

      // Global rate limit
      RxO.withLatestFrom(globalCount$),
      RxO.concatMap(([request, count]) =>
        count > 0
          ? Rx.of(request)
          : globalCount$.pipe(
              RxO.first((count) => count > 0),
              RxO.map(() => request),
            ),
      ),

      // Update counts
      RxO.tap((req) => sentRequests.next(req)),

      whenDebug(([_op, _route, opts]) =>
        console.error(
          "[RATE-LIMITS]",
          "triggerRequests$",
          opts.method,
          opts.url,
          opts.params,
          opts.data,
        ),
      ),

      // Trigger the request
      RxO.tap(([_op, _route, _opts, resolve]) => resolve()),
    );

    return {
      request,
      response,
      error,
      start() {
        const triggerSub = triggerRequests$.subscribe();
        const bucketSub = bucketCounters$.subscribe();

        return () => {
          triggerSub.unsubscribe();
          bucketSub.unsubscribe();

          ops.complete();
          sentRequests.complete();
          routeTimeouts.complete();
        };
      },
    };
  };
