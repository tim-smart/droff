import * as F from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as RL from "../../rate-limits/rxjs";
import * as Store from "../../rate-limits/store";
import { Request, Response } from "../rate-limits";

export const createLimiter =
  (store: Store.Store) =>
  (
    responses$: Rx.Observable<Response>,
    whenDebug: <T>(fn: (d: T) => void) => Rx.MonoTypeOperatorFunction<T>,
  ) => {
    const rateLimit = RL.rateLimit(store);

    const rateLimits$ = responses$.pipe(
      RxO.flatMap(({ route, rateLimit }) =>
        F.pipe(
          rateLimit,
          O.fold(
            () => Rx.EMPTY,
            (rateLimit) => Rx.of({ route, ...rateLimit } as const),
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

    const start = () => {
      const routeToBucketSub = routeToBucket$.subscribe();
      const bucketsSub = buckets$.subscribe();

      return () => {
        routeToBucketSub.unsubscribe();
        bucketsSub.unsubscribe();
      };
    };

    return {
      start,
      bucketLimiter: () => (requests$: Rx.Observable<Request>) =>
        requests$.pipe(
          RxO.flatMap((request) =>
            Rx.zip(Rx.of(request), store.getBucketForRoute(request.route)),
          ),

          // Group by bucket or undefined
          RxO.groupBy(
            ([_, bucket]) =>
              F.pipe(
                bucket,
                O.map(({ key }) => key),
                O.toUndefined,
              ),
            {
              duration: (requests$) =>
                requests$.key
                  ? // Garbage collect bucket rate limiters after inactivity
                    requests$.pipe(
                      RxO.debounce(([_, bucket]) =>
                        Rx.timer(
                          (bucket as O.Some<Store.BucketDetails>).value
                            .resetAfter * 2,
                        ),
                      ),
                    )
                  : // Never garbage collect the global pass-through
                    Rx.NEVER,
            },
          ),

          // Apply rate limits
          RxO.mergeMap((requests$) =>
            requests$.key
              ? F.pipe(requests$, applyRateLimit(rateLimit, whenDebug))
              : requests$,
          ),

          RxO.map(([request]) => request),
        ),
    };
  };

const applyRateLimit =
  (
    rateLimit: RL.RateLimitOp,
    whenDebug: <T>(fn: (d: T) => void) => Rx.MonoTypeOperatorFunction<T>,
  ) =>
  (
    requests$: Rx.Observable<readonly [Request, O.Option<Store.BucketDetails>]>,
  ) =>
    F.pipe(
      requests$,
      RxO.first(),
      RxO.flatMap((item) => {
        const [
          _,
          {
            value: { key, resetAfter, limit },
          },
        ] = item as [Request, O.Some<Store.BucketDetails>];

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
          rateLimit(`rest.bucket.${key}`, resetAfter * 1.1, limit),
        );
      }),
    );
