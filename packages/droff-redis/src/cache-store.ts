import { createClient } from "redis";
import { CacheStore, NonParentCacheStore } from "droff/dist/caches/stores";
import { Snowflake } from "droff/dist/types";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";

export interface CreateStoreOpts {
  client: ReturnType<typeof createClient>;
  prefix?: string;
}

export const createCacheStore =
  ({ client, prefix = "droff" }: CreateStoreOpts) =>
  <T>(storePrefix: string, ttl?: number): CacheStore<T> => {
    const key = `${prefix}:${storePrefix}`;
    const keyForIds = `${key}:ids`;
    const keyForParent = (parentId: Snowflake) => `${key}:parent:${parentId}`;
    const keyForResource = (resourceId: string) => `${key}:r:${resourceId}`;

    return {
      size: () => client.SCARD(keyForIds),
      sizeForParent: (parentId) =>
        client
          .SINTER([keyForIds, keyForParent(parentId)])
          .then((results) => results.length),

      get: async (resourceId) => {
        const json = await client.GET(keyForResource(resourceId));
        return json ? JSON.parse(json) : undefined;
      },

      getForParent: async (parentId) => {
        const ids = await client.SINTER([keyForIds, keyForParent(parentId)]);
        const keys = ids.map(keyForResource);
        const results = await client.MGET(keys);

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
          .SET(keyForResource(resourceId), JSON.stringify(resource), {
            PX: ttl,
          })
          .SADD(keyForIds, resourceId)
          .SADD(parentKey, resourceId)
          .exec();
      },

      delete: async (parentId, resourceId) => {
        const parentKey = keyForParent(parentId);
        await client
          .multi()
          .DEL(keyForResource(resourceId))
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
          .SREM(keyForIds, ids)
          .DEL(keys)
          .DEL(parentKey)
          .exec();
      },

      effects$: ttl
        ? Rx.interval(ttl * 2).pipe(
            RxO.exhaustMap(async () => {
              const ids = await client.SMEMBERS(keyForIds);
              if (ids.length === 0) return;
              const keys = ids.map(keyForResource);

              const results = await client.MGET(keys);
              const missing = results
                .filter((result) => result === null)
                .map((_, index) => ids[index]);
              if (missing.length === 0) return;

              await client.SREM(keyForIds, missing);
            }),
            RxO.ignoreElements(),
          )
        : undefined,
    };
  };

export const createNonParentCacheStore =
  ({ client, prefix = "droff" }: CreateStoreOpts) =>
  <T>(storePrefix: string, ttl?: number): NonParentCacheStore<T> => {
    const key = `${prefix}:${storePrefix}`;
    const keyForIds = `${key}:ids`;
    const keyForResource = (id: string) => `${key}:r:${id}`;

    return {
      size: () => client.SCARD(keyForIds),

      get: async (resourceId) => {
        const json = await client.GET(keyForResource(resourceId));
        return json ? JSON.parse(json) : undefined;
      },

      set: async (resourceId, resource) => {
        await client.SET(keyForResource(resourceId), JSON.stringify(resource), {
          PX: ttl,
        });
      },

      delete: async (resourceId) => {
        await client
          .multi()
          .DEL(keyForResource(resourceId))
          .SREM(keyForIds, resourceId)
          .exec();
      },

      effects$: ttl
        ? Rx.interval(ttl * 2).pipe(
            RxO.exhaustMap(async () => {
              const ids = await client.SMEMBERS(keyForIds);
              if (ids.length === 0) return;
              const keys = ids.map(keyForResource);

              const results = await client.MGET(keys);
              const missing = results
                .filter((result) => result === null)
                .map((_, index) => ids[index]);
              if (missing.length === 0) return;

              await client.SREM(keyForIds, missing);
            }),
            RxO.ignoreElements(),
          )
        : undefined,
    };
  };
