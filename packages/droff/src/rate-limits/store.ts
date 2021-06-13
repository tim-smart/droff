import * as F from "fp-ts/function";
import * as O from "fp-ts/Option";

export type BucketDetails = {
  key: string;
  resetAfter: number;
  limit: number;
};

export interface Store {
  hasBucket: (bucketKey: string) => Promise<boolean>;
  putBucket: (bucket: BucketDetails) => Promise<void>;

  getBucketForRoute: (route: string) => Promise<O.Option<BucketDetails>>;
  putBucketRoute: (route: string, bucketKey: string) => Promise<void>;

  maybeWait: (key: string, window: number, limit: number) => Promise<void>;
}

interface Counter {
  remaining: number;
  expires: number;
}

/**
 * Default rate limit store, that uses `Map`'s to store everything.
 */
export const createMemoryStore = (): Store => {
  const buckets = new Map<string, BucketDetails>();
  const routes = new Map<string, string>();
  const counters = new Map<string, Counter>();

  async function wait(
    key: string,
    window: number,
    limit: number,
  ): Promise<void> {
    const { remaining, expires } = F.pipe(
      O.fromNullable(counters.get(key)),
      O.filter(({ expires }) => expires > Date.now()),
      O.getOrElse(() => ({
        expires: Date.now() + window,
        remaining: limit,
      })),
    );

    if (remaining <= 0) {
      return new Promise((resolve) => {
        setTimeout(resolve, expires - Date.now());
      }).then(() => wait(key, window, limit));
    }

    counters.set(key, {
      expires,
      remaining: remaining - 1,
    });
  }

  return {
    hasBucket: async (key) => buckets.has(key),
    putBucket: async (bucket) => {
      buckets.set(bucket.key, bucket);
    },

    getBucketForRoute: async (route) =>
      O.fromNullable(buckets.get(routes.get(route)!)),
    putBucketRoute: async (route, bucket) => {
      routes.set(route, bucket);
    },

    maybeWait: wait,
  };
};
