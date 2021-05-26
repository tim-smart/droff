const Pkg = require("../../package.json");

import Axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  Method,
} from "axios";
import { createRoutes } from "../types";
import * as RateLimits from "./rate-limits";

const VERSION = 9;

export interface Options {
  /** Global rate limit in requests per second */
  rateLimit?: number;
  /** Turn on debug logging */
  debug?: boolean;
}

export function create(
  token: string,
  { rateLimit = 50, debug = false }: Options = {},
) {
  const client = Axios.create({
    baseURL: `https://discord.com/api/v${VERSION}`,
    headers: {
      Authorization: `Bot ${token}`,
      UserAgent: `DiscordBot (https://github.com/tim-smart/droff, ${Pkg.version})`,
    },
    timeout: 10000,
  });

  const { request, response, error, start } = RateLimits.interceptors(
    rateLimit,
    1000,
    debug,
  )(client);

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
  )}`;
  throw err;
};

export const routes = (client: AxiosInstance) => {
  return createRoutes<AxiosRequestConfig>(
    ({ method, url, params = {}, options = {} }) => {
      const hasBody = method !== "GET" && method !== "DELETE";

      return client
        .request({
          ...options,
          method: method as Method,
          url,
          params: hasBody
            ? options.params
            : {
                ...(options.params || {}),
                ...params,
              },
          data: hasBody
            ? {
                ...(options.data || {}),
                ...params,
              }
            : options.data,
        })
        .then((r) => r.data, handleError);
    },
  );
};

export type Routes = ReturnType<typeof routes>;
