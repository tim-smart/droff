import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import { GuildCreateEvent, Snowflake } from "../types";

export interface CrudObservables<T> {
  id: (resource: T) => string;
  init?: (guild: GuildCreateEvent) => Rx.Observable<T>;

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
    init = () => Rx.EMPTY,
    create$ = Rx.EMPTY,
    update$ = Rx.EMPTY,
    delete$ = Rx.EMPTY,
    effects$ = Rx.NEVER,
  }: CrudObservables<T>,
): Rx.Observable<WatchOp<T>> =>
  Rx.merge(
    fromDispatch("GUILD_CREATE").pipe(
      RxO.flatMap((guild) =>
        init(guild).pipe(
          RxO.catchError(() => Rx.EMPTY),
          RxO.map((r) => [guild.id, r] as const),
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
