import {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";
import * as F from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as Buckets from "./rate-limits/buckets";
import * as Utils from "./rate-limits/utils";

const debugTap =
  (enabled: boolean) =>
  <T>(fn: (data: T) => void) =>
  (source$: Rx.Observable<T>) =>
    enabled ? source$.pipe(RxO.tap(fn)) : source$;

export type Request = {
  route: string;
  config: AxiosRequestConfig;
  resolve: () => void;
};

export type Response = {
  route: string;
  config: AxiosRequestConfig;
  response: AxiosResponse;
  rateLimit: Utils.RateLimitDetails;
};

export const interceptors =
  (limit: number, window: number, debug = false) =>
  (axios: AxiosInstance) => {
    const whenDebug = debugTap(debug);

    // Interceptor handlers
    const requests$ = new Rx.Subject<Request>();
    function request(config: AxiosRequestConfig): Promise<AxiosRequestConfig> {
      return new Promise((resolve) => {
        requests$.next({
          config,
          route: Utils.routeFromConfig(config),
          resolve: () => resolve(config),
        });
      });
    }

    const responses$ = new Rx.Subject<Response>();
    function response(response: AxiosResponse) {
      responses$.next({
        response,
        config: response.config,
        route: Utils.routeFromConfig(response.config),
        rateLimit: Utils.rateLimitFromHeaders(response.headers),
      });
      return response;
    }

    const errors$ = new Rx.Subject<AxiosError>();
    function error(err: AxiosError) {
      if (!err.response) return Promise.reject(err);

      if (debug) {
        console.error(
          "[rate-limits.ts]",
          "Axios error",
          err.response.status,
          err.config.method,
          err.config.url,
        );
      }

      response(err.response);
      errors$.next(err);

      // Maybe attempt retry
      if (err.response.status !== 429) return Promise.reject(err);
      return F.pipe(
        Utils.retryAfter(err.response.headers),
        O.fold(
          () => Promise.reject(err),
          (retryMs) =>
            new Promise((r) => setTimeout(r, retryMs)).then(() =>
              axios.request(err.config),
            ),
        ),
      );
    }

    const limitRequestBuckets = Buckets.createLimiter(responses$, whenDebug);

    // Trigger requests
    const triggerRequests$ = requests$.pipe(
      limitRequestBuckets(),

      // Global rate limit
      Utils.rateLimit(limit, window),

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

    return {
      request,
      response,
      error,
      start() {
        const triggerSub = triggerRequests$.subscribe();
        return () => {
          triggerSub.unsubscribe();
          requests$.complete();
          responses$.complete();
          errors$.complete();
        };
      },
    };
  };
