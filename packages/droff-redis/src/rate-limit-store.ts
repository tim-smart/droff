import { Store } from "droff/dist/rate-limits/store";
import { CreateStoreOpts } from "./cache-store";

export const createRateLimitStore =
  ({ client, prefix = "droff" }: CreateStoreOpts) =>
  (): Store => {
    const key = (key: string) => `${prefix}:${key}`;
    const keyForBucket = (bucket: string) => key(`bucket:${bucket}`);
    const keyForRoute = (route: string) => key(`route:${route}`);
    const keyForCounter = (bucket: string) => key(`counter:${bucket}`);

    return {
      hasBucket: async (key) => {
        const result = await client.exists(keyForBucket(key));
        return result === 1;
      },

      putBucket: async (bucket) => {
        const key = keyForBucket(bucket.key);
        await client.set(key, JSON.stringify(bucket));
      },

      getBucketForRoute: async (route) => {
        const key = keyForRoute(route);
        const bucketId = await client.get(key);
        if (!bucketId) return undefined;

        const bucketKey = keyForBucket(bucketId);
        const json = await client.get(bucketKey);
        if (!json) return undefined;

        return JSON.parse(json);
      },

      putBucketRoute: async (route, bucketId) => {
        const key = keyForRoute(route);
        await client.set(key, bucketId);
      },

      incrementCounter: async (bucketKey, window, limit) => {
        const key = keyForCounter(bucketKey);

        const [, reply, delayReply] = await client
          .multi()
          .set(key, 0, {
            NX: true,
            PX: window,
          })
          .incr(key)
          .PTTL(key)
          .exec();

        const count = +reply!;
        const delay = +delayReply!;
        const actualDelay = delay < 0 ? window : delay;

        return count > limit ? actualDelay : 0;
      },
    };
  };
