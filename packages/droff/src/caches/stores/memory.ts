import { Snowflake } from "../../types";
import { CacheStore, NonGuildCacheStore } from ".";

export const createMemoryStore = <T>(): CacheStore<T> => {
  const map = new Map<string, T>();
  const guildMap = new Map<Snowflake, Map<string, T>>();

  return {
    size: () => Promise.resolve(map.size),

    get: (resourceId) => Promise.resolve(map.get(resourceId)),

    getForGuild: (guildId) => {
      const map = guildMap.get(guildId) || new Map<string, T>();
      return Promise.resolve(map);
    },

    set: (guildId, resourceId, resource) => {
      map.set(resourceId, resource);
      if (!guildMap.has(guildId)) {
        guildMap.set(guildId, new Map());
      }
      guildMap.get(guildId)!.set(resourceId, resource);
      return Promise.resolve();
    },

    delete: (guildId, resourceId) => {
      map.delete(resourceId);
      guildMap.get(guildId)?.delete(resourceId);
      return Promise.resolve();
    },

    guildDelete: (guildId) => {
      const ids = guildMap.get(guildId)?.keys();
      if (ids) {
        for (const id in ids) {
          map.delete(id);
        }
      }

      guildMap.delete(guildId);

      return Promise.resolve();
    },
  };
};

export const createNonGuildMemoryStore = <T>(): NonGuildCacheStore<T> => {
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
