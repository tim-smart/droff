import { pipe } from "fp-ts/lib/function";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Snowflake } from "../../types";
import { WatchOp } from "../resources";
import * as Memory from "./memory";

export interface CacheStore<T> {
  size: () => Promise<number>;
  sizeForParent: (parentId: Snowflake) => Promise<number>;
  get: (resourceId: string) => Promise<T | undefined>;
  getForParent: (parentId: Snowflake) => Promise<ReadonlyMap<string, T>>;
  set: (parentId: Snowflake, resourceId: string, resource: T) => Promise<void>;
  delete: (parentId: Snowflake, resourceId: string) => Promise<void>;
  parentDelete: (parentId: Snowflake) => Promise<void>;
  effects$?: Rx.Observable<never>;
}

export interface NonParentCacheStore<T> {
  size: () => Promise<number>;
  get: (resourceId: string) => Promise<T | undefined>;
  set: (resourceId: string, resource: T) => Promise<void>;
  delete: (resourceId: string) => Promise<void>;
  effects$?: Rx.Observable<never>;
}

export interface ReadOnlyCacheStore<T>
  extends Pick<
    CacheStore<T>,
    "get" | "getForParent" | "size" | "sizeForParent"
  > {
  watch$: Rx.Observable<WatchOp<T>>;
}

export interface ReadOnlyNonParentCacheStore<T>
  extends Pick<NonParentCacheStore<T>, "get" | "size"> {
  watch$: Rx.Observable<WatchOp<T>>;
}

export type CacheStoreFactory<T> = (
  store?: CacheStore<T>,
) => readonly [ReadOnlyCacheStore<T>, Rx.Observable<void>];

export type NonParentCacheStoreFactory<T> = (
  store?: NonParentCacheStore<T>,
) => readonly [ReadOnlyNonParentCacheStore<T>, Rx.Observable<void>];

export const fromWatch =
  <T>(watch$: Rx.Observable<WatchOp<T>>): CacheStoreFactory<T> =>
  (store = Memory.create<T>()) => {
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
            return store.parentDelete(op.guildId);
        }
      }),
    );

    return [
      {
        watch$,
        get: store.get,
        getForParent: store.getForParent,
        size: store.size,
        sizeForParent: store.sizeForParent,
      },
      store.effects$ ? Rx.merge(effects$, store.effects$) : effects$,
    ] as const;
  };

export const fromWatchNonParent =
  <T>(watch$: Rx.Observable<WatchOp<T>>): NonParentCacheStoreFactory<T> =>
  (store = Memory.createNonParent<T>()) => {
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

    return [
      { watch$, get: store.get, size: store.size },
      store.effects$ ? Rx.merge(effects$, store.effects$) : effects$,
    ] as const;
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
