import { BucketDetails, Counter, Store } from "../store";

/**
 * Default rate limit store, that uses `Map`'s to store everything.
 */
export const createMemoryStore = (): Store => {
  const buckets = new Map<string, BucketDetails>();
  const routes = new Map<string, string>();
  const counters = new Map<string, Counter>();

  return {
    hasBucket: async (key) => buckets.has(key),
    putBucket: async (bucket) => {
      buckets.set(bucket.key, bucket);
    },

    getBucketForRoute: async (route) => buckets.get(routes.get(route)!),
    putBucketRoute: async (route, bucket) => {
      routes.set(route, bucket);
    },

    getCounter: (key) => Promise.resolve(counters.get(key)),
    putCounter: (key, counter) => {
      counters.set(key, counter);
      return Promise.resolve();
    },
  };
};
