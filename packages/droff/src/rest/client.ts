let Pkg: any;
try {
  Pkg = require("../package.json");
} catch (err) {
  Pkg = require("../../package.json");
}

import Axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  Method,
} from "axios";
import { createRoutes } from "../types";
import * as RateLimits from "./rate-limits";
import * as Store from "../rate-limits/store";
import { EMPTY, NEVER } from "rxjs";
import * as MemoryStore from "../rate-limits/stores/memory";

const VERSION = 10;

export interface Options {
  /** Bot token */
  token: string;
  /** Rate limit store */
  rateLimitStore?: Store.Store;
  /** Global rate limit in requests per second */
  rateLimit?: number;
  /** How much extra delay to add to rate limits */
  rateLimitMargin?: number;
  /** Change baseURL (if using a proxy) */
  baseURL?: string;
  /** Disable rate limiting */
  disableRateLimiter?: boolean;
}

export function create({
  token,
  rateLimitStore = MemoryStore.create(),
  rateLimit = 50,
  baseURL = `https://discord.com/api/v${VERSION}`,
  rateLimitMargin,
  disableRateLimiter = false,
}: Options) {
  if (disableRateLimiter) {
    return {
      client: Axios.create({ baseURL }),
      rateLimiting$: EMPTY,
      debug$: NEVER,
    } as const;
  }

  const client = Axios.create({
    baseURL,
    headers: {
      Authorization: `Bot ${token}`,
      "User-Agent": `DiscordBot (https://github.com/tim-smart/droff, ${Pkg.version})`,
    },
    timeout: 10000,
  });

  const {
    request,
    response,
    error,
    effects$: rateLimiting$,
    debug$,
  } = RateLimits.interceptors({
    rateLimitStore,
    globalLimit: rateLimit,
    globalWindow: 1000,
    delayMargin: rateLimitMargin,
    axios: client,
  });

  client.interceptors.request.use(request);
  client.interceptors.response.use(response, error);

  return { client, rateLimiting$, debug$ } as const;
}

const handleError = (err: AxiosError) => {
  err.message = `REST error: ${err.response?.status} ${JSON.stringify(
    err.config,
    null,
    2,
  )} ${JSON.stringify(err.response?.data, null, 2)}`;
  throw err;
};

interface FormData {
  append: (key: string, value: unknown) => void;
  getHeaders: () => Record<string, string>;
}

export const routes = (client: AxiosInstance) =>
  createRoutes<AxiosRequestConfig>(({ method, url, params, options = {} }) => {
    const hasBody = method !== "GET" && method !== "DELETE";
    let hasFormData = false;

    if (typeof options.data?.append === "function") {
      hasFormData = true;
      (options.data as FormData).append("payload_json", JSON.stringify(params));
    }

    const qsParams = hasBody ? options.params : params ?? options.params;
    const data =
      hasFormData || !hasBody ? options.data : params ?? options.data;

    return client
      .request({
        ...options,
        headers: {
          ...(options.headers || {}),
          ...(hasFormData ? data.getHeaders() : {}),
        },
        method: method as Method,
        url,
        params: qsParams,
        data,
      })
      .then((r) => r.data, handleError);
  });

export type Routes = ReturnType<typeof routes>;
