import {
  APIGuild,
  GatewayDispatchEvents as E,
  Snowflake,
} from "discord-api-types/v8";
import { Map } from "immutable";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import { GuildMap, withOp } from "./guilds";

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

export const withLatest =
  (guilds$: Rx.Observable<GuildMap>) =>
  <M extends { [key: string]: Rx.Observable<GuildSnowflakeMap<any>> }>(
    obserables: M,
  ) => {
    const obEntries = Object.entries(obserables);
    const obKeys = obEntries.map((e) => e[0]);
    const obValues = obEntries.map((e) => e[1]);

    return <T>(guildID: (resource: T) => Snowflake | undefined) =>
      (source$: Rx.Observable<T>) =>
        source$.pipe(
          RxO.withLatestFrom(guilds$),
          RxO.withLatestFrom(...obValues),
          RxO.map(([[resource, guilds], ...results]) => {
            const guild = guilds.get(guildID(resource)!);
            if (!guild) return [resource, undefined] as const;

            const resultMap = obKeys.reduce(
              (map, key, index) => ({
                ...map,
                [key]: results[index].get(guild.id),
              }),
              {} as {
                [K in keyof M]: M[K] extends Rx.Observable<
                  GuildSnowflakeMap<infer V>
                >
                  ? SnowflakeMap<V>
                  : never;
              },
            );

            return [
              resource,
              {
                guild,
                ...resultMap,
              },
            ] as const;
          }),
        );
  };
