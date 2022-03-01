import { createClient } from "redis";
import { CacheStore, NonParentCacheStore } from "droff/dist/caches/stores";
import { Snowflake } from "droff/dist/types";

export interface CreateStoreOpts {
  client: ReturnType<typeof createClient>;
  prefix?: string;
}

export const createCacheStore =
  ({ client, prefix = "droff" }: CreateStoreOpts) =>
  <T>(storePrefix: string): CacheStore<T> => {
    const key = `${prefix}:${storePrefix}`;
    const keyForParent = (parentId: Snowflake) => `${key}:parent:${parentId}`;

    return {
      size: () => client.hLen(key),
      sizeForParent: (parentId) => client.SCARD(keyForParent(parentId)),

      get: async (resourceId) => {
        const json = await client.hGet(key, resourceId);
        return json ? JSON.parse(json) : undefined;
      },

      getForParent: async (parentId) => {
        const ids = await client.sMembers(keyForParent(parentId));
        const results = await client.hmGet(key, ids);

        return results.reduce((acc, result, index) => {
          if (!result) return acc;
          const parsed = JSON.parse(result) as T;
          acc.set(ids[index], parsed);
          return acc;
        }, new Map<string, T>());
      },

      set: async (parentId, resourceId, resource) => {
        const parentKey = keyForParent(parentId);

        await client
          .multi()
          .hSet(key, resourceId, JSON.stringify(resource))
          .sAdd(parentKey, resourceId)
          .exec();
      },

      delete: async (parentId, resourceId) => {
        const parentKey = keyForParent(parentId);
        await client
          .multi()
          .hDel(key, resourceId)
          .sRem(parentKey, resourceId)
          .exec();
      },

      parentDelete: async (parentId) => {
        const parentKey = keyForParent(parentId);
        const ids = await client.sMembers(parentKey);

        await client.multi().hDel(key, ids).del(parentKey).exec();
      },
    };
  };

export const createNonParentCacheStore =
  ({ client, prefix = "droff" }: CreateStoreOpts) =>
  <T>(storePrefix: string): NonParentCacheStore<T> => {
    const key = `${prefix}:${storePrefix}`;

    return {
      size: () => client.hLen(key),

      get: async (resourceId) => {
        const json = await client.hGet(key, resourceId);
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
