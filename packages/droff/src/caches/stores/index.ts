import { pipe } from "fp-ts/lib/function";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Snowflake } from "../../types";
import { WatchOp } from "../resources";
import { createMemoryStore, createNonGuildMemoryStore } from "./memory";

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
  size: () => Promise<number>;
  get: (resourceId: string) => Promise<T | undefined>;
  set: (resourceId: string, resource: T) => Promise<void>;
  delete: (resourceId: string) => Promise<void>;
}

export type CacheStoreFactory<T> = (
  store?: CacheStore<T>,
) => readonly [Pick<CacheStore<T>, "get" | "getForGuild">, Rx.Observable<void>];

export type NonGuildCacheStoreFactory<T> = (
  store?: NonGuildCacheStore<T>,
) => readonly [Pick<NonGuildCacheStore<T>, "get">, Rx.Observable<void>];

export const fromWatch =
  <T>(watch$: Rx.Observable<WatchOp<T>>): CacheStoreFactory<T> =>
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

    return [
      {
        get: store.get,
        getForGuild: store.getForGuild,
      },
      effects$,
    ] as const;
  };

export const fromWatchNonGuild =
  <T>(watch$: Rx.Observable<WatchOp<T>>): NonGuildCacheStoreFactory<T> =>
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

    return [{ get: store.get }, effects$] as const;
  };

type WithCachesResult<M extends { [key: string]: WithCachesFn<any> }> = {
  [K in keyof M]: M[K] extends WithCachesFn<infer V> ? V : never;
};
type WithCachesFn<T> = (guildId: Snowflake) => Promise<T | undefined>;

export const withCaches = <M extends { [key: string]: WithCachesFn<any> }>(
  stores: M,
) => {
  const storeEntries = Object.entries(stores);
  const storeKeys = storeEntries.map((e) => e[0]);
  const storeValues = storeEntries.map((e) => e[1]);

  return <T>(getParentId: (resource: T) => Snowflake | undefined) =>
    (
      source$: Rx.Observable<T>,
    ): Rx.Observable<readonly [T, WithCachesResult<M> | undefined]> => {
      if (storeValues.length === 0) return source$ as any;

      return source$.pipe(
        RxO.flatMap((item) => {
          const parentId = getParentId(item);
          if (!parentId) return Rx.of(item);
          return Rx.zip(Rx.of(item), ...storeValues.map((s) => s(parentId)));
        }),
        RxO.map((item) => {
          if (!Array.isArray(item)) return [item, undefined] as const;

          const [resource, ...results] = item;

          const resultMap = storeKeys.reduce(
            (map, key, index) => ({
              ...map,
              [key]: results[index],
            }),
            {} as WithCachesResult<M>,
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
