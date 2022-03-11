import * as F from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as RL from "../../rate-limits/rxjs";
import * as Store from "../../rate-limits/store";
import { Request, Response } from "../rate-limits";

export interface LimiterOptions {
  rateLimitStore: Store.Store;
  responses$: Rx.Observable<Response>;
  delayMargin?: number;
  whenDebug: <T>(fn: (d: T) => void) => Rx.MonoTypeOperatorFunction<T>;
}

const bucketForRouteFactory = (store: Store.Store) => (route: string) =>
  store.getBucketForRoute(route).then(
    (bucket): Store.BucketDetails =>
      bucket ?? {
        // For undiscovered routes use a default rate limit
        key: route,
        resetAfter: 5000,
        limit: 1,
      },
  );

export const createLimiter = ({
  rateLimitStore: store,
  responses$,
  delayMargin = 30,
  whenDebug,
}: LimiterOptions) => {
  const rateLimit = RL.rateLimit(store);

  const rateLimits$ = responses$.pipe(
    RxO.map(({ route, rateLimit }) =>
      F.pipe(
        rateLimit,
        O.fold(
          () => ({
            route,
            bucket: "global",
            resetAfter: 0,
            limit: 0,
            remaining: 0,
          }),
          (rateLimit) => ({ route, ...rateLimit }),
        ),
      ),
    ),
    RxO.share(),
  );

  const routeToBucket$ = rateLimits$.pipe(
    RxO.flatMap(({ route, bucket }) => store.putBucketRoute(route, bucket)),
  );

  const buckets$ = rateLimits$.pipe(
    RxO.flatMap(async ({ bucket, remaining, limit, resetAfter }) => {
      const hasBucket = await store.hasBucket(bucket);

      if (!hasBucket || limit - 1 === remaining) {
        await store.putBucket({
          key: bucket,
          resetAfter,
          limit,
        });
      }
    }),
  );

  const effects$ = Rx.merge(routeToBucket$, buckets$);
  const bucketForRoute = bucketForRouteFactory(store);

  return {
    effects$,
    bucketLimiter: () => (requests$: Rx.Observable<Request>) =>
      requests$.pipe(
        RxO.flatMap((request) =>
          Rx.zip(Rx.of(request), bucketForRoute(request.route)),
        ),

        // Group by bucket or undefined
        RxO.groupBy(([_, bucket]) => bucket.key, {
          duration: (requests$) =>
            requests$.key === "global"
              ? Rx.NEVER
              : // Garbage collect bucket rate limiters after inactivity
                requests$.pipe(
                  RxO.debounce(([_, bucket]) =>
                    Rx.timer(bucket!.resetAfter * 2),
                  ),
                ),
        }),

        // Apply rate limits
        RxO.mergeMap((requests$) => {
          if (requests$.key === "global") {
            return requests$;
          }

          return F.pipe(
            requests$,
            applyRateLimit(rateLimit, whenDebug, delayMargin),
          );
        }),

        RxO.map(([request]) => request),
      ),
  };
};

const applyRateLimit =
  (
    rateLimit: RL.RateLimitOp,
    whenDebug: LimiterOptions["whenDebug"],
    delayMargin: number,
  ) =>
  (requests$: Rx.Observable<readonly [Request, Store.BucketDetails]>) =>
    F.pipe(
      requests$,
      RxO.first(),
      RxO.flatMap((item) => {
        const [_, { key, resetAfter, limit }] = item;

        return requests$.pipe(
          RxO.startWith(item),
          whenDebug(([request, bucket]) =>
            console.log(
              "[rate-limits/buckets.ts]",
              "rate limiting request",
              request.route,
              bucket,
            ),
          ),
          rateLimit(`rest.bucket.${key}`, resetAfter + delayMargin, limit),
        );
      }),
    );
