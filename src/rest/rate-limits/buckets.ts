import { AxiosError } from "axios";
import * as F from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as Im from "immutable";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Request, Response } from "../rate-limits";
import * as Utils from "./utils";

export type BucketDetails = {
  key: string;
  resetAfter: number;
  limit: number;
};

export const createLimiter = (
  responses$: Rx.Observable<Response>,
  whenDebug: <T>(fn: (d: T) => void) => Rx.MonoTypeOperatorFunction<T>,
) => {
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
    RxO.startWith("init" as const),
    RxO.scan(
      (map, op) => (op === "init" ? map : map.set(op.route, op.bucket)),
      Im.Map<string, string>(),
    ),
    RxO.shareReplay(1),
  );

  const buckets$ = rateLimits$.pipe(
    RxO.startWith("init" as const),
    RxO.scan((buckets, op) => {
      if (op === "init") return buckets;

      const { bucket, remaining, limit, resetAfter } = op;

      if (!buckets.has(bucket)) {
        return buckets.set(bucket, { key: bucket, resetAfter, limit });
      } else if (limit - 1 === remaining) {
        return buckets.set(bucket, { key: bucket, resetAfter, limit });
      }

      return buckets;
    }, Im.Map<string, BucketDetails>()),
    RxO.shareReplay(1),
  );

  return () => (requests$: Rx.Observable<Request>) =>
    requests$.pipe(
      RxO.withLatestFrom(routeToBucket$, buckets$),
      RxO.map(
        ([request, routes, buckets]) =>
          [request, buckets.get(routes.get(request.route)!)] as const,
      ),

      RxO.groupBy(
        ([_, bucket]) => bucket?.key,
        undefined,
        (requests$) =>
          requests$.key
            ? requests$.pipe(
                RxO.debounce(([_, bucket]) => Rx.timer(bucket!.resetAfter * 2)),
              )
            : Rx.NEVER,
      ),

      RxO.withLatestFrom(buckets$),
      RxO.map(
        ([requests$, buckets]) =>
          [requests$, buckets.get(requests$.key!)] as const,
      ),

      RxO.mergeMap(([requests$, bucket]) =>
        bucket
          ? requests$.pipe(
              Utils.rateLimit(bucket.limit, bucket.resetAfter * 1.1),
            )
          : requests$,
      ),

      RxO.map(([request]) => request),
    );
};
