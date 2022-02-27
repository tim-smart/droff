import { pipe } from "fp-ts/lib/function";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Guild, Snowflake } from "../types";
import { WatchOp } from "./resources";

export type SnowflakeMap<T> = Map<string, T>;
export type GuildSnowflakeMap<T> = Map<Snowflake, SnowflakeMap<T>>;

export interface CacheStore<T> {
  get: (resourceId: string) => Promise<T | undefined>;
  getForGuild: (guildId: Snowflake) => Promise<Map<string, T>>;
  set: (guildId: Snowflake, resourceId: string, resource: T) => Promise<void>;
  delete: (guildId: Snowflake, resourceId: string) => Promise<void>;
  guildDelete: (guildId: Snowflake) => Promise<void>;
}

export interface NonGuildCacheStore<T> {
  get: (resourceId: string) => Promise<T | undefined>;
  set: (resourceId: string, resource: T) => Promise<void>;
  delete: (resourceId: string) => Promise<void>;
}

export type CacheStoreFactory<T> = (
  store?: CacheStore<T>,
) => readonly [CacheStore<T>, Rx.Observable<void>];

export type NonGuildCacheStoreFactory<T> = (
  store?: NonGuildCacheStore<T>,
) => readonly [NonGuildCacheStore<T>, Rx.Observable<void>];

export const createMemoryStore = <T>(): CacheStore<T> => {
  const map = new Map<string, T>();
  const guildMap = new Map<Snowflake, Map<string, T>>();

  return {
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

export const fromWatch =
  <T>(watch$: Rx.Observable<WatchOp<T>>) =>
  (store = createMemoryStore<T>()) => {
    const effects$ = pipe(
      watch$,
      RxO.flatMap((op) => {
        switch (op.event) {
          case "create":
          case "update":
            return store.set(op.guildId, op.resourceId, op.resource);

          case "delete":
            return store.delete(op.guildId, op.resourceId);

          case "guild_delete":
            return store.guildDelete(op.guildId);
        }
      }),
    );

    return [store, effects$] as const;
  };

export const fromWatchNonGuild =
  <T>(watch$: Rx.Observable<WatchOp<T>>) =>
  (store = createNonGuildMemoryStore<T>()) => {
    const effects$ = pipe(
      watch$,
      RxO.flatMap((op) => {
        switch (op.event) {
          case "create":
          case "update":
            return store.set(op.resourceId, op.resource);

          case "delete":
            return store.delete(op.resourceId);

          case "guild_delete":
            return Rx.EMPTY;
        }
      }),
    );

    return [store, effects$] as const;
  };

type CacheResult<M extends { [key: string]: CacheStore<any> }> = {
  [K in keyof M]: M[K] extends CacheStore<infer V> ? Map<string, V> : never;
};

export const withCaches = <M extends { [key: string]: CacheStore<any> }>(
  stores: M,
) => {
  const storeEntries = Object.entries(stores);
  const storeKeys = storeEntries.map((e) => e[0]);
  const storeValues = storeEntries.map((e) => e[1]);

  return <T>(getGuildID: (resource: T) => Snowflake | undefined) =>
    (
      source$: Rx.Observable<T>,
    ): Rx.Observable<readonly [T, CacheResult<M> | undefined]> => {
      if (storeValues.length === 0) return source$ as any;

      return source$.pipe(
        RxO.flatMap((item) => {
          const guildId = getGuildID(item);
          if (!guildId) return Rx.of(item);

          return Rx.zip(
            Rx.of(item),
            ...storeValues.map((s) => s.getForGuild(guildId)),
          );
        }),
        RxO.map((item) => {
          if (!Array.isArray(item)) return [item, undefined] as const;

          const [resource, ...results] = item;

          const resultMap = storeKeys.reduce(
            (map, key, index) => ({
              ...map,
              [key]: results[index],
            }),
            {} as CacheResult<M>,
          );

          return [resource, resultMap];
        }),
      );
    };
};

export const onlyWithCacheResults =
  () =>
  <T, M>(source$: Rx.Observable<readonly [T, M | undefined]>) =>
    source$.pipe(RxO.filter(([_, map]) => !!map)) as Rx.Observable<
      readonly [T, M]
    >;
