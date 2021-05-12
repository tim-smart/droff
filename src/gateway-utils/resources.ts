import {
  APIGuild,
  GatewayDispatchEvents as E,
  Snowflake,
} from "discord-api-types/v8";
import { Map } from "immutable";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import { withOp } from "./guilds";

export type SnowflakeMap<T> = Map<Snowflake, T>;
export type GuildSnowflakeMap<T> = Map<Snowflake, SnowflakeMap<T>>;

export interface CrudObserables<T> {
  id: (resource: T) => Snowflake;

  create$?: Rx.Observable<readonly [Snowflake, T]>;
  update$: Rx.Observable<readonly [Snowflake, T]>;
  delete$?: Rx.Observable<readonly [Snowflake, Snowflake]>;
}

export const watch$ = <T>(
  dispatch$: Dispatch,
  guildProp: keyof APIGuild,
  { id, create$ = Rx.EMPTY, update$, delete$ = Rx.EMPTY }: CrudObserables<T>,
): Rx.Observable<GuildSnowflakeMap<T>> =>
  Rx.merge(
    Rx.of(["init"] as const),

    dispatch$(E.GuildCreate).pipe(
      RxO.flatMap((guild) =>
        Rx.from(((guild[guildProp]! as any[]) || []) as T[]).pipe(
          RxO.map((r) => [guild.id, r] as const),
        ),
      ),
      RxO.map(withOp("create")),
    ),
    dispatch$(E.GuildDelete).pipe(RxO.map(withOp("guild_delete"))),

    create$.pipe(RxO.map(withOp("create"))),
    update$.pipe(RxO.map(withOp("update"))),
    delete$.pipe(RxO.map(withOp("delete"))),
  ).pipe(
    RxO.scan((map, op) => {
      let guild_id: Snowflake;
      let resource: T;
      let resourceID: Snowflake;

      switch (op[0]) {
        case "guild_delete":
          return map.delete(op[1].id);

        case "create":
        case "update":
          [guild_id, resource] = op[1];
          return map.setIn([guild_id, id(resource)], resource);

        case "delete":
          [guild_id, resourceID] = op[1];
          return map.deleteIn([guild_id, resourceID]);
      }

      return map;
    }, Map() as GuildSnowflakeMap<T>),

    RxO.shareReplay(1),
  );
