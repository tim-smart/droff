import { AxiosRequestConfig } from "axios";
import * as F from "fp-ts/function";
import { sequenceT } from "fp-ts/lib/Apply";
import * as O from "fp-ts/Option";

const majorResources = ["channels", "guilds", "webhooks"] as const;

export const routeFromConfig = ({ url, method }: AxiosRequestConfig) => {
  if (!url) return "";

  // Only keep major ID's
  const routeURL = url
    .replace(/\/([A-Za-z]+)\/(\d{16,21}|@me)/g, (match, resource) =>
      majorResources.includes(resource) ? match : `/${resource}`,
    )
    // Strip reactions
    .replace(/\/reactions\/(.*)/, "/reactions");

  return `${method}-${routeURL}`;
};

export const numberHeader = (headers: any) => (key: string) =>
  F.pipe(
    O.fromNullable(headers[key]),
    O.map(parseFloat),
    O.filter((n) => !isNaN(n)),
  );

export const retryAfter = (headers: any) =>
  F.pipe(
    numberHeader(headers)("x-ratelimit-reset-after"),
    O.map((secs) => secs * 1000),
  );

export const rateLimitFromHeaders = (headers: any) =>
  F.pipe(
    sequenceT(O.Apply)(
      retryAfter(headers),
      numberHeader(headers)("x-ratelimit-limit"),
      numberHeader(headers)("x-ratelimit-remaining"),
      O.fromNullable(headers["x-ratelimit-bucket"] as string),
    ),
    O.map(([resetAfter, limit, remaining, bucket]) => ({
      bucket,
      resetAfter,
      limit,
      remaining,
    })),
  );
export type RateLimitDetails = ReturnType<typeof rateLimitFromHeaders>;
