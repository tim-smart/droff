import {
  CacheStore,
  CacheStoreWithTTL,
  NonParentCacheStore,
  NonParentCacheStoreWithTTL,
} from "droff/caches/stores";
import { Snowflake } from "droff/types";
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
          acc.set(id, JSON.parse(result));
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

// == TTL versions
export const createCacheStoreWithTTL =
  ({ client, prefix = "droff" }: CreateStoreOpts) =>
  <T>(storePrefix: string, ttl: number): CacheStoreWithTTL<T> => {
    const key = `${prefix}:cache:${storePrefix}`;
    const keyForIds = `${key}:ids`;
    const keyForResource = (id: string) => `${key}:r:${id}`;
    const keyForParent = (id: Snowflake) => `${key}:parent:${id}`;

    return {
      /** WARNING: Will be inaccurate, for performance reasons */
      size: () => client.SCARD(keyForIds),
      /** WARNING: Will be inaccurate, for performance reasons */
      sizeForParent: (parentId) => client.SCARD(keyForParent(parentId)),

      refreshTTL: async (resourceId) => {
        await client.PEXPIRE(keyForResource(resourceId), ttl);
      },

      get: async (resourceId) => {
        const key = keyForResource(resourceId);
        const json = await client.GETEX(key, { PX: ttl });

        // On misses, clear up the ids set
        if (!json) {
          client.SREM(keyForIds, key);
        }

        return json ? JSON.parse(json) : undefined;
      },

      /** Un-efficient for large parents */
      getForParent: async (parentId) => {
        const parentKey = keyForParent(parentId);
        const ids = await client.SMEMBERS(parentKey);
        const keys = ids.map(keyForResource);

        // Better way to expire multiple keys?
        const results = await client.multiExecutor(
          keys.map((key) => ({ args: ["GETEX", key, "PX", `${ttl}`] })),
        );

        const map = new Map<string, T>();
        const misses: string[] = [];

        (results as (string | null)[]).forEach((result, index) => {
          const id = ids[index];

          if (!result) {
            misses.push(id);
            return;
          }

          map.set(id, JSON.parse(result));
        });

        // Clean up misses
        if (misses.length > 0) {
          client.SREM(keyForIds, misses);
          client.SREM(parentKey, misses);
        }

        return map;
      },

      set: async (parentId, resourceId, resource) => {
        const key = keyForResource(resourceId);
        const parentKey = keyForParent(parentId);

        await client
          .multi()
          // Only set initial ttl for new items
          .SET(key, "null", { NX: true, PX: ttl })
          .SET(key, JSON.stringify(resource))
          .SADD(keyForIds, resourceId)
          .SADD(parentKey, resourceId)
          .exec();
      },

      delete: async (parentId, resourceId) => {
        const key = keyForResource(resourceId);
        const parentKey = keyForParent(parentId);
        await client
          .multi()
          .DEL(key)
          .SREM(keyForIds, resourceId)
          .SREM(parentKey, resourceId)
          .exec();
      },

      parentDelete: async (parentId) => {
        const parentKey = keyForParent(parentId);
        const ids = await client.SMEMBERS(parentKey);
        const keys = ids.map(keyForResource);
        await client
          .multi()
          .DEL(keys)
          .DEL(parentKey)
          .SREM(keyForIds, ids)
          .exec();
      },
    };
  };

export const createNonParentCacheStoreWithTTL =
  ({ client, prefix = "droff" }: CreateStoreOpts) =>
  <T>(storePrefix: string, ttl: number): NonParentCacheStoreWithTTL<T> => {
    const key = `${prefix}:cache:${storePrefix}`;
    const keyForIds = `${key}:ids`;
    const keyForResource = (id: string) => `${key}:r:${id}`;

    return {
      /** WARNING: Will be inaccurate, for performance reasons */
      size: () => client.SCARD(keyForIds),

      refreshTTL: async (resourceId) => {
        await client.PEXPIRE(keyForResource(resourceId), ttl);
      },

      get: async (resourceId) => {
        const key = keyForResource(resourceId);
        const json = await client.GETEX(key, { PX: ttl });

        // On misses, clear up the ids set
        if (!json) {
          client.SREM(keyForIds, key);
        }

        return json ? JSON.parse(json) : undefined;
      },

      set: async (resourceId, resource) => {
        const key = keyForResource(resourceId);

        await client
          .multi()
          .SET(key, "null", { NX: true, PX: ttl })
          .SET(key, JSON.stringify(resource))
          .SADD(keyForIds, resourceId)
          .exec();
      },

      delete: async (resourceId) => {
        const key = keyForResource(resourceId);
        await client.multi().DEL(key).SREM(keyForIds, resourceId).exec();
      },
    };
  };
