import {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";
import * as F from "fp-ts/function";
import * as O from "fp-ts/Option";
import { QueueingSubject } from "queueing-subject";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as RL from "../rate-limits/rxjs";
import * as Store from "../rate-limits/store";
import * as Buckets from "./rate-limits/buckets";
import * as Helpers from "./rate-limits/helpers";

const debugTap =
  (subject: Rx.Subject<() => void>) =>
  <T>(fn: (data: T) => void) =>
  (source$: Rx.Observable<T>) =>
    source$.pipe(RxO.tap((a) => subject.next(() => fn(a))));

export type Request = {
  route: string;
  config: AxiosRequestConfig;
  resolve: () => void;
};

export type Response = {
  route: string;
  config: AxiosRequestConfig;
  response: AxiosResponse;
  rateLimit: Helpers.RateLimitDetails;
};

export interface Options {
  rateLimitStore: Store.Store;
  globalLimit: number;
  globalWindow: number;
  delayMargin?: number;
  axios: AxiosInstance;
}

export const interceptors = ({
  rateLimitStore: store,
  globalLimit,
  globalWindow,
  delayMargin,
  axios,
}: Options) => {
  const debugSubject = new Rx.Subject<() => void>();
  const whenDebug = debugTap(debugSubject);

  // Interceptor handlers
  const requests$ = new QueueingSubject<Request>();
  function request(config: AxiosRequestConfig): Promise<AxiosRequestConfig> {
    return new Promise((resolve) => {
      requests$.next({
        config,
        route: Helpers.routeFromConfig(config),
        resolve: () => resolve(config),
      });
    });
  }

  const responses$ = new QueueingSubject<Response>();
  function response(response: AxiosResponse) {
    responses$.next({
      response,
      config: response.config,
      route: Helpers.routeFromConfig(response.config),
      rateLimit: Helpers.rateLimitFromHeaders(response.headers),
    });
    return response;
  }

  function error(err: AxiosError) {
    if (!err.response) return Promise.reject(err);

    debugSubject.next(() =>
      console.error(
        "[rate-limits.ts]",
        "Axios error",
        err.response!.status,
        err.config.method,
        err.config.url,
      ),
    );

    response(err.response);

    // Maybe attempt retry
    if (err.response.status !== 429) return Promise.reject(err);
    return F.pipe(
      Helpers.retryAfter(err.response.headers),
      O.fold(
        () => Promise.reject(err),
        (retryMs) =>
          new Promise((r) => setTimeout(r, retryMs)).then(() =>
            axios.request(err.config),
          ),
      ),
    );
  }

  const { effects$: bucketEffects$, bucketLimiter } = Buckets.createLimiter({
    rateLimitStore: store,
    responses$,
    delayMargin,
    whenDebug,
  });

  // Trigger requests
  const triggerRequests$ = requests$.pipe(
    bucketLimiter(),

    // Global rate limit
    RL.rateLimit(store)("rest.global", globalWindow, globalLimit),

    whenDebug(({ config }) =>
      console.error(
        "[rate-limits.ts]",
        "triggerRequests$",
        config.method,
        config.url,
        config.params,
        config.data,
      ),
    ),

    // Trigger the request
    RxO.tap(({ resolve }) => resolve()),
  );

  const effects$ = Rx.merge(bucketEffects$, triggerRequests$).pipe(
    RxO.ignoreElements(),
  );

  const debug$ = debugSubject.pipe(
    RxO.tap((f) => f()),
    RxO.ignoreElements(),
  );

  return {
    request,
    response,
    error,
    effects$,
    debug$,
  };
};
