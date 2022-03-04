import { Store } from "droff/dist/rate-limits/store";
import { delayFrom } from "droff/dist/rate-limits/stores/utils";
import { number } from "fp-ts";
import { WatchError } from "redis";
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

      getDelay: async (bucketKey, window, limit) => {
        const key = keyForCounter(bucketKey);
        const perRequest = Math.ceil(window / limit);

        const tryIncr = async (): Promise<[number, number]> => {
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
              return tryIncr();
            }

            throw err;
          }
        };

        const [count, ttl] = await tryIncr();

        if (count <= limit) {
          return 0;
        }

        return delayFrom(window, limit, count, ttl);
      },
    };
  };
