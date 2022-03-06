import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import { Guild, Snowflake } from "../types";

export interface CrudObserables<T> {
  id: (resource: T) => string;
  guildProp?: keyof Guild;
  init?: (guild: Guild) => Promise<T[]>;

  create$?: Rx.Observable<readonly [Snowflake, T]>;
  update$?: Rx.Observable<readonly [Snowflake, T]>;
  delete$?: Rx.Observable<readonly [Snowflake, string]>;
  effects$?: Rx.Observable<never>;
}

export type CreateOp<T> = {
  event: "create";
  parentId?: Snowflake;
  resourceId: string;
  resource: T;
};
export type UpdateOp<T> = {
  event: "update";
  parentId?: Snowflake;
  resourceId: string;
  resource: T;
};
export type DeleteOp = {
  event: "delete";
  parentId?: Snowflake;
  resourceId: string;
};
export type ParentDeleteOp = { event: "parent_delete"; parentId: Snowflake };

export type WatchOp<T> = CreateOp<T> | UpdateOp<T> | DeleteOp | ParentDeleteOp;

export const watch$ = <T>(
  fromDispatch: Dispatch,
  {
    id,
    guildProp,
    init = () => Promise.resolve([]),
    create$ = Rx.EMPTY,
    update$ = Rx.EMPTY,
    delete$ = Rx.EMPTY,
    effects$ = Rx.NEVER,
  }: CrudObserables<T>,
): Rx.Observable<WatchOp<T>> =>
  Rx.merge(
    fromDispatch("GUILD_CREATE").pipe(
      RxO.flatMap((guild) =>
        Rx.merge(
          Rx.from((guildProp ? guild[guildProp] || [] : []) as T[]).pipe(
            RxO.map((r) => [guild.id, r] as const),
          ),
          Rx.from(init(guild)).pipe(
            RxO.catchError(() => []),
            RxO.flatMap((items) => items),
            RxO.map((r) => [guild.id, r] as const),
          ),
        ),
      ),
      RxO.map(
        ([guildId, resource]): CreateOp<T> => ({
          event: "create",
          parentId: guildId,
          resourceId: id(resource),
          resource,
        }),
      ),
    ),
    fromDispatch("GUILD_DELETE").pipe(
      RxO.map(
        (guild): ParentDeleteOp => ({
          event: "parent_delete",
          parentId: guild.id,
        }),
      ),
    ),

    create$.pipe(
      RxO.map(
        ([guildId, resource]): CreateOp<T> => ({
          event: "create",
          parentId: guildId,
          resourceId: id(resource),
          resource,
        }),
      ),
    ),
    update$.pipe(
      RxO.map(
        ([guildId, resource]): UpdateOp<T> => ({
          event: "update",
          parentId: guildId,
          resourceId: id(resource),
          resource,
        }),
      ),
    ),
    delete$.pipe(
      RxO.map(
        ([guildId, resourceId]): DeleteOp => ({
          event: "delete",
          parentId: guildId,
          resourceId,
        }),
      ),
    ),
    effects$,
  );
