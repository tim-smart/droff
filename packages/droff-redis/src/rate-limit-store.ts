import { Store } from "droff/dist/rate-limits/store";
import { WatchError } from "redis";
import { CreateStoreOpts } from "./cache-store";

export const createRateLimitStore =
  ({ client, prefix = "droff" }: CreateStoreOpts) =>
  (): Store => {
    const key = (key: string) => `${prefix}:${key}`;
    const keyForBucket = (bucket: string) => key(`bucket:${bucket}`);
    const keyForRoute = (route: string) => key(`route:${route}`);
    const keyForCounter = (bucket: string) => key(`counter:${bucket}`);

    const incrementCounter = async (
      bucketKey: string,
      window: number,
      limit: number,
    ): Promise<[number, number]> => {
      const key = keyForCounter(bucketKey);
      const perRequest = Math.ceil(window / limit);

      try {
        return await client.executeIsolated(async (c) => {
          c.WATCH(key);
          const pttl = await c.PTTL(key);
          const newPttl = pttl < 0 ? perRequest : pttl + perRequest;

          const [count, , ttl] = await c
            .multi()
            .INCR(key)
            .PEXPIRE(key, newPttl)
            .PTTL(key)
            .exec();

          return [+count!, +ttl!];
        });
      } catch (err) {
        if (err instanceof WatchError) {
          return incrementCounter(bucketKey, window, limit);
        }

        throw err;
      }
    };

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

      incrementCounter,
    };
  };
