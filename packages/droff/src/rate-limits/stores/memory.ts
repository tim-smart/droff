import { BucketDetails, Store } from "../store";

interface Counter {
  count: number;
  expires: number;
}

/**
 * Default rate limit store, that uses `Map`'s to store everything.
 */
export const create = (): Store => {
  const bucketDetails = new Map<string, BucketDetails>();
  const routeToBucket = new Map<string, string>();
  const counters = new Map<string, Counter>();

  const getCounter = (key: string) => {
    const counter = counters.get(key);

    if (!counter || counter.expires <= Date.now()) {
      return undefined;
    }

    return counter;
  };

  return {
    hasBucket: async (key) => bucketDetails.has(key),
    putBucket: async (bucket) => {
      bucketDetails.set(bucket.key, bucket);
    },

    getBucketForRoute: async (route) =>
      bucketDetails.get(routeToBucket.get(route)!),

    putBucketRoute: async (route, bucket) => {
      routeToBucket.set(route, bucket);
    },

    incrementCounter: (key, window, limit) => {
      const now = Date.now();
      const perRequest = Math.ceil(window / limit);
      const counter = getCounter(key) ?? {
        expires: now,
        count: 0,
      };

      const count = counter.count + 1;
      const expires = counter.expires + perRequest;
      counters.set(key, { ...counter, count, expires });

      return Promise.resolve([count, expires - now]);
    },
  };
};
