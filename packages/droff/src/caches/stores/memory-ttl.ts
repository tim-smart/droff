import { Snowflake } from "../../types";
import { CacheStore, NonParentCacheStore } from ".";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";

const second = 1000;
const minute = 60 * second;

export interface MemoryTTLStoreOpts {
  /** The approx. number of milliseconds to keep items */
  ttl: number;

  /**
   * How often items should be cleared.
   *
   * Defaults to 5 minutes
   */
  resolution?: number;

  /**
   * What sweep strategy to use.
   *
   * "activity" means the TTL is reset for every `set` OR `get` operation
   * "usage" means the TTL is only reset for the `get` operation
   *
   * Defaults to "usage"
   */
  strategy?: "activity" | "usage";
}

interface TTLBucket {
  expires: number;
  ids: Set<string>;
}

export const createNonParent = <T>({
  ttl,
  resolution = 1 * minute,
  strategy = "usage",
}: MemoryTTLStoreOpts): NonParentCacheStore<T> => {
  const additionalMilliseconds =
    (Math.floor(ttl / resolution) + 1) * resolution;

  const items = new Map<string, T>();
  const buckets: TTLBucket[] = [];

  const refreshTTL = (id: string) => {
    const now = Date.now();
    const remainder = now % resolution;
    const expires = now - remainder + additionalMilliseconds;
    let currentBucket = buckets[buckets.length - 1];

    if ((currentBucket?.expires || 0) < expires) {
      currentBucket = {
        expires,
        ids: new Set(),
      };
      buckets.push(currentBucket);
    }

    currentBucket.ids.add(id);

    // Remove from previous buckets
    for (let index = 0, length = buckets.length - 1; index < length; index++) {
      buckets[index].ids.delete(id);
    }
  };

  const sweep = () => {
    const now = Date.now();
    const remainder = now % resolution;
    const currentExpires = now - remainder;

    while (buckets.length && buckets[0].expires <= currentExpires) {
      const bucket = buckets.shift()!;
      bucket.ids.forEach((id) => {
        items.delete(id);
      });
    }
  };

  const getSync = (resourceId: string) => {
    const item = items.get(resourceId);
    if (!item) return undefined;

    refreshTTL(resourceId);
    return item;
  };

  return {
    size: async () => items.size,

    getSync,
    get: async (id) => getSync(id),

    set: async (resourceId, resource) => {
      const exists = items.has(resourceId);
      const needsRefresh = exists === false || strategy === "activity";

      items.set(resourceId, resource);

      if (needsRefresh) {
        refreshTTL(resourceId);
      }
    },

    delete: async (resourceId) => {
      items.delete(resourceId);
    },

    effects$: Rx.interval(resolution / 2).pipe(
      RxO.tap(sweep),
      RxO.ignoreElements(),
    ),
  };
};

export const create = <T>(opts: MemoryTTLStoreOpts): CacheStore<T> => {
  const store = createNonParent<T>(opts);
  const parentIds = new Map<Snowflake, Set<string>>();

  return {
    size: store.size,
    sizeForParent: async (parentId) => parentIds.get(parentId)?.size ?? 0,

    getSync: store.getSync,
    get: store.get,

    getForParent: async (parentId) => {
      const ids = parentIds.get(parentId);
      const results = new Map<string, T>();
      if (!ids) return results;

      ids.forEach((id) => {
        const item = store.getSync!(id);
        if (!item) {
          ids.delete(id);
          return;
        }

        results.set(id, item);
      });

      return results;
    },

    set: async (parentId, resourceId, resource) => {
      store.set(resourceId, resource);

      if (!parentIds.has(parentId)) {
        parentIds.set(parentId, new Set());
      }
      parentIds.get(parentId)!.add(resourceId);
    },

    delete: async (parentId, resourceId) => {
      store.delete(resourceId);
      parentIds.get(parentId)?.delete(resourceId);
    },

    parentDelete: async (parentId) => {
      const ids = parentIds.get(parentId);
      parentIds.delete(parentId);

      if (ids) {
        ids.forEach((id) => {
          store.delete(id);
        });
      }
    },

    effects$: store.effects$,
  };
};
