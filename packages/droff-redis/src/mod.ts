import {
  createCacheStoreWithTTL,
  createNonParentCacheStoreWithTTL,
  CreateStoreOpts,
} from "./cache-store";
import { createCacheStore, createNonParentCacheStore } from "./cache-store";
import { createRateLimitStore } from "./rate-limit-store";
import { createSharderStore } from "./sharder-store";
import { pullPayloads, pushPayloads } from "./streaming";

export * from "./cache-store";
export * from "./rate-limit-store";
export * from "./streaming";

export const createStores = (opts: CreateStoreOpts) => ({
  cache: createCacheStore(opts),
  nonParentCache: createNonParentCacheStore(opts),

  cacheWithTTL: createCacheStoreWithTTL(opts),
  nonParentCacheWithTTL: createNonParentCacheStoreWithTTL(opts),

  rateLimit: createRateLimitStore(opts),

  pushPayloads: pushPayloads(opts),
  pullPayloads: pullPayloads(opts),

  sharder: createSharderStore(opts),
});
