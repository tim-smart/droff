import { createClient } from "@node-redis/client";
import { CacheStore, NonGuildCacheStore } from "droff/dist/caches/stores";
import { Snowflake } from "droff/dist/types";

export interface CreateStoreOpts {
  client: ReturnType<typeof createClient>;
  prefix?: string;
}

export const createCacheStore =
  ({ client, prefix = "droff" }: CreateStoreOpts) =>
  <T>(storePrefix: string): CacheStore<T> => {
    const key = (key: string) => `${prefix}:${storePrefix}:${key}`;
    const keyForGuild = (guildId: Snowflake) => key(`guild:${guildId}`);

    return {
      get: async (resourceId) => {
        const json = await client.get(key(resourceId));
        return json ? JSON.parse(json) : undefined;
      },

      getForGuild: async (guildId) => {
        const ids = await client.sMembers(keyForGuild(guildId));
        const keys = ids.map(key);
        const results = await client.mGet(keys);

        return results.reduce((acc, result, index) => {
          if (!result) return acc;
          const parsed = JSON.parse(result) as T;
          acc.set(ids[index], parsed);
          return acc;
        }, new Map<string, T>());
      },

      set: async (guildId, resourceId, resource) => {
        const guildKey = keyForGuild(guildId);
        const resourceKey = key(resourceId);

        await client
          .multi()
          .set(resourceKey, JSON.stringify(resource))
          .sAdd(guildKey, resourceId)
          .exec();
      },

      delete: async (guildId, resourceId) => {
        const guildKey = keyForGuild(guildId);
        const resourceKey = key(resourceId);

        await client.multi().del(resourceKey).sRem(guildKey, resourceId).exec();
      },

      guildDelete: async (guildId) => {
        const guildKey = keyForGuild(guildId);
        const ids = await client.sMembers(guildKey);
        const keys = ids.map(key);

        keys.push(guildKey);

        await client.del(keys);
      },
    };
  };

export const createNonGuildCacheStore =
  ({ client, prefix = "droff" }: CreateStoreOpts) =>
  <T>(storePrefix: string): NonGuildCacheStore<T> => {
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
