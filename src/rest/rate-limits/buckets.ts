import { AxiosError } from "axios";
import * as F from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as Im from "immutable";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Request, Response } from "../rate-limits";
import * as Utils from "./utils";

export const createCounters = (
  responses$: Rx.Observable<Response>,
  errors$: Rx.Observable<AxiosError>,
  whenDebug: <T>(fn: (d: T) => void) => Rx.MonoTypeOperatorFunction<T>,
) => {
  const processedRequests$ = new Rx.Subject<Request>();
  function sent(request: Request) {
    processedRequests$.next(request);
  }

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

  const routeToBucket$ = Rx.merge(Rx.of("init" as const), rateLimits$).pipe(
    RxO.scan(
      (map, op) => (op === "init" ? map : map.set(op.route, op.bucket)),
      Im.Map<string, string>(),
    ),
    RxO.shareReplay(1),
  );

  const errorsWithBucket$ = errors$.pipe(
    RxO.map((error) => ({
      route: Utils.routeFromConfig(error.config),
      error,
    })),
    RxO.withLatestFrom(routeToBucket$),
    RxO.filter(([error, routes]) => routes.has(error.route)),
    RxO.map(([error, routes]) => ({
      ...error,
      bucket: routes.get(error.route)!,
    })),
  );

  const resetting = new Set<string>();
  const resets$ = rateLimits$.pipe(
    RxO.filter(({ bucket }) => !resetting.has(bucket)),
    RxO.tap(({ bucket }) => resetting.add(bucket)),
    RxO.flatMap((reset) =>
      Rx.of(reset).pipe(RxO.delay(reset.resetAfter * 1.1)),
    ),
    RxO.tap(({ bucket }) => resetting.delete(bucket)),
    RxO.share(),
  );

  const newRoutes$ = rateLimits$.pipe(
    RxO.withLatestFrom(routeToBucket$),
    RxO.filter(([{ route }, routes]) => !routes.has(route)),
    RxO.map(([data]) => data),
  );

  const routeCounters$ = processedRequests$.pipe(
    RxO.scan(
      (counts, { route }) => counts.update(route, 0, (count) => count - 1),
      Im.Map<string, number>(),
    ),
    RxO.shareReplay(1),
  );

  const timeouts$ = errorsWithBucket$.pipe(
    RxO.filter(({ error }) => error.code === "ECONNABORTED"),
  );

  const bucketCounters$ = Rx.merge(
    Rx.of(["init"] as const),
    newRoutes$.pipe(
      RxO.withLatestFrom(routeCounters$),
      RxO.map(
        ([{ route, bucket }, routeCounts]) =>
          ["new-route", bucket, routeCounts.get(route, 0)] as const,
      ),
    ),
    processedRequests$.pipe(
      RxO.withLatestFrom(routeToBucket$),
      RxO.flatMap(([{ route }, routes]) =>
        F.pipe(
          O.fromNullable(routes.get(route)),
          O.fold(
            () => Rx.EMPTY,
            (bucket) => Rx.of(["request", bucket] as const),
          ),
        ),
      ),
    ),
    resets$.pipe(
      RxO.map(({ bucket, limit }) => ["reset", bucket, limit] as const),
    ),
    timeouts$.pipe(RxO.map(({ bucket }) => ["timeout", bucket] as const)),
  ).pipe(
    whenDebug((op) =>
      console.error("[rate-limits/buckets.ts]", "bucketCounters$", op),
    ),
    RxO.scan((counts, op) => {
      switch (op[0]) {
        case "init":
          return counts;
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

  return {
    sent,
    bucketCounters$,
    routeToBucket$,
    complete: () => {
      processedRequests$.complete();
    },
  };
};
