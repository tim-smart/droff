import { Snowflake } from "../../types";
import { CacheStore, NonParentCacheStore } from ".";

export const create = <T>(): CacheStore<T> => {
  const map = new Map<string, T>();
  const parentMap = new Map<Snowflake, Map<string, T>>();

  return {
    size: () => Promise.resolve(map.size),
    sizeForParent: (parentId) =>
      Promise.resolve(parentMap.get(parentId)?.size ?? 0),

    get: (resourceId) => Promise.resolve(map.get(resourceId)),

    getForParent: (parentId) => {
      const map = parentMap.get(parentId) || new Map<string, T>();
      return Promise.resolve(map);
    },

    set: (parentId, resourceId, resource) => {
      map.set(resourceId, resource);
      if (!parentMap.has(parentId)) {
        parentMap.set(parentId, new Map());
      }
      parentMap.get(parentId)!.set(resourceId, resource);
      return Promise.resolve();
    },

    delete: (parentId, resourceId) => {
      map.delete(resourceId);
      parentMap.get(parentId)?.delete(resourceId);
      return Promise.resolve();
    },

    parentDelete: (parentId) => {
      const ids = parentMap.get(parentId)?.keys();
      if (ids) {
        for (const id in ids) {
          map.delete(id);
        }
      }

      parentMap.delete(parentId);

      return Promise.resolve();
    },
  };
};

export const createNonParent = <T>(): NonParentCacheStore<T> => {
  const map = new Map<string, T>();

  return {
    size: () => Promise.resolve(map.size),

    get: (resourceId) => Promise.resolve(map.get(resourceId)),

    set: (resourceId, resource) => {
      map.set(resourceId, resource);
      return Promise.resolve();
    },

    delete: (resourceId) => {
      map.delete(resourceId);
      return Promise.resolve();
    },
  };
};
