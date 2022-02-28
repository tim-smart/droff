import type { CreateStoreOpts } from "./cache-store";
import { createCacheStore, createNonGuildCacheStore } from "./cache-store";
import { createRateLimitStore } from "./rate-limit-store";
import { pullPayloads, pushPayloads } from "./streaming";

export * from "./cache-store";
export * from "./rate-limit-store";
export * from "./streaming";

export const createStores = (opts: CreateStoreOpts) => ({
  cache: createCacheStore(opts),
  nonGuildCache: createNonGuildCacheStore(opts),
  rateLimit: createRateLimitStore(opts),

  pushPayloads: pushPayloads(opts),
  pullPayloads: pullPayloads(opts),
});
