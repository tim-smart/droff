import { BucketDetails, Counter, Store } from "../store";

/**
 * Default rate limit store, that uses `Map`'s to store everything.
 */
export const create = (): Store => {
  const buckets = new Map<string, BucketDetails>();
  const routes = new Map<string, string>();
  const counters = new Map<string, Counter>();

  const getCounter = (key: string) => {
    const counter = counters.get(key);

    if (!counter || counter.expires <= Date.now()) {
      return undefined;
    }

    return counter;
  };

  return {
    hasBucket: async (key) => buckets.has(key),
    putBucket: async (bucket) => {
      buckets.set(bucket.key, bucket);
    },

    getBucketForRoute: async (route) => buckets.get(routes.get(route)!),
    putBucketRoute: async (route, bucket) => {
      routes.set(route, bucket);
    },

    incrementCounter: (key, window, limit) => {
      const counter = getCounter(key) || {
        expires: Date.now() + window,
        count: 0,
      };

      const count = counter.count + 1;

      if (count > limit) {
        return Promise.resolve(counter.expires - Date.now());
      }

      counters.set(key, { ...counter, count });
      return Promise.resolve(0);
    },
  };
};
