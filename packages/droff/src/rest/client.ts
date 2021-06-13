const Pkg = require("../../package.json");

import Axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  Method,
} from "axios";
import { createRoutes } from "../types";
import * as RateLimits from "./rate-limits";
import * as Store from "../rate-limits/store";

const VERSION = 9;

export interface Options {
  /** Bot token */
  token: string;
  /** Rate limit store */
  rateLimitStore: Store.Store;
  /** Global rate limit in requests per second */
  rateLimit?: number;
  /** Turn on debug logging */
  debug?: boolean;
}

export function create({
  token,
  rateLimitStore = Store.createMemoryStore(),
  rateLimit = 50,
  debug = false,
}: Options) {
  const client = Axios.create({
    baseURL: `https://discord.com/api/v${VERSION}`,
    headers: {
      Authorization: `Bot ${token}`,
      UserAgent: `DiscordBot (https://github.com/tim-smart/droff, ${Pkg.version})`,
    },
    timeout: 10000,
  });

  const { request, response, error, start } = RateLimits.interceptors({
    rateLimitStore,
    globalLimit: rateLimit,
    globalWindow: 1000,
    debug,
    axios: client,
  });

  client.interceptors.request.use(request);
  client.interceptors.response.use(response, error);

  const stop = start();
  return [client, stop] as const;
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
  createRoutes<AxiosRequestConfig>(
    ({ method, url, params = {}, options = {} }) => {
      const hasBody = method !== "GET" && method !== "DELETE";
      let hasFormData = false;

      if (typeof options.data?.append === "function") {
        hasFormData = true;
        (options.data as FormData).append(
          "payload_json",
          JSON.stringify(params),
        );
      }

      const qsParams = hasBody
        ? options.params
        : {
            ...(options.params || {}),
            ...params,
          };
      const data =
        hasFormData || !hasBody
          ? options.data
          : {
              ...(options.data || {}),
              ...params,
            };

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
    },
  );

export type Routes = ReturnType<typeof routes>;
