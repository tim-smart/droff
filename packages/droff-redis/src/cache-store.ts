import { CacheStore, NonParentCacheStore } from "droff/dist/caches/stores";
import { Snowflake } from "droff/dist/types";
import { createClient } from "redis";

export interface CreateStoreOpts {
  client: ReturnType<typeof createClient>;
  prefix?: string;
}

export const createCacheStore =
  ({ client, prefix = "droff" }: CreateStoreOpts) =>
  <T>(storePrefix: string): CacheStore<T> => {
    const key = `${prefix}:cache:${storePrefix}`;
    const keyForParent = (parentId: Snowflake) => `${key}:parent:${parentId}`;

    return {
      size: () => client.HLEN(key),
      sizeForParent: async (parentId) => client.SCARD(keyForParent(parentId)),

      get: async (resourceId) => {
        const json = await client.HGET(key, resourceId);
        return json ? JSON.parse(json) : undefined;
      },

      getForParent: async (parentId) => {
        const ids = await client.SMEMBERS(keyForParent(parentId));
        const results = await client.HMGET(key, ids);

        return results.reduce((acc, result, index) => {
          if (!result) {
            return acc;
          }

          const id = ids[index];
          const parsed = JSON.parse(result) as T;
          acc.set(id, parsed);
          return acc;
        }, new Map<string, T>());
      },

      set: async (parentId, resourceId, resource) => {
        const parentKey = keyForParent(parentId);

        await client
          .multi()
          .HSET(key, resourceId, JSON.stringify(resource))
          .SADD(parentKey, resourceId)
          .exec();
      },

      delete: async (parentId, resourceId) => {
        const parentKey = keyForParent(parentId);
        await client
          .multi()
          .HDEL(key, resourceId)
          .SREM(parentKey, resourceId)
          .exec();
      },

      parentDelete: async (parentId) => {
        const parentKey = keyForParent(parentId);
        const ids = await client.SMEMBERS(parentKey);
        await client.multi().HDEL(key, ids).DEL(parentKey).exec();
      },
    };
  };

export const createNonParentCacheStore =
  ({ client, prefix = "droff" }: CreateStoreOpts) =>
  <T>(storePrefix: string): NonParentCacheStore<T> => {
    const key = `${prefix}:${storePrefix}`;

    return {
      size: () => client.HLEN(key),

      get: async (resourceId) => {
        const json = await client.HGET(key, resourceId);
        return json ? JSON.parse(json) : undefined;
      },

      set: async (resourceId, resource) => {
        await client.HSET(key, resourceId, JSON.stringify(resource));
      },

      delete: async (resourceId) => {
        await client.HDEL(key, resourceId);
      },
    };
  };
