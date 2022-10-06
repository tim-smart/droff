import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { CacheStoreWithTTL, NonParentCacheStoreWithTTL } from ".";
import { Snowflake } from "../../types";

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

interface CacheItem<T> {
  resource: T;
}

interface TTLBucket<T> {
  expires: number;
  items: CacheItem<T>[];
}

export const createNonParent = <T>({
  ttl,
  resolution = 1 * minute,
  strategy = "usage",
}: MemoryTTLStoreOpts): NonParentCacheStoreWithTTL<T> => {
  const additionalMilliseconds =
    (Math.floor(ttl / resolution) + 1) * resolution;

  const items = new Map<string, WeakRef<CacheItem<T>>>();
  const buckets: TTLBucket<T>[] = [];

  const refreshTTL = (item: CacheItem<T>) => {
    const now = Date.now();
    const remainder = now % resolution;
    const expires = now - remainder + additionalMilliseconds;
    let currentBucket = buckets[buckets.length - 1];

    if ((currentBucket?.expires || 0) < expires) {
      currentBucket = {
        expires,
        items: [],
      };
      buckets.push(currentBucket);
    }

    currentBucket.items.push(item);
  };

  const sweep = () => {
    const now = Date.now();
    const remainder = now % resolution;
    const currentExpires = now - remainder;

    while (buckets.length && buckets[0].expires <= currentExpires) {
      buckets.shift()!;
    }

    if (global.gc) {
      global.gc();
    }
  };

  const getSync = (resourceId: string) => {
    const ref = items.get(resourceId);
    if (!ref) return undefined;

    const item = ref.deref();
    if (!item) {
      items.delete(resourceId);
      return undefined;
    }

    refreshTTL(item);

    return item.resource;
  };

  return {
    size: async () => items.size,

    getSync,
    get: async (id) => getSync(id),

    refreshTTL: async (id) => {
      getSync(id);
    },

    set: async (resourceId, resource) => {
      const item = items.get(resourceId)?.deref();

      if (item && strategy === "usage") {
        item.resource = resource;
      } else {
        const newItem = { resource };
        refreshTTL(newItem);
        items.set(resourceId, new WeakRef(newItem));
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

export const create = <T>(opts: MemoryTTLStoreOpts): CacheStoreWithTTL<T> => {
  const store = createNonParent<T>(opts);
  const parentIds = new Map<Snowflake, Set<string>>();

  return {
    size: store.size,
    sizeForParent: async (parentId) => parentIds.get(parentId)?.size ?? 0,

    refreshTTL: store.refreshTTL,

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
