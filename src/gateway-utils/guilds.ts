import {
  APIGuild,
  GatewayDispatchEvents as E,
  Snowflake,
} from "discord-api-types/v8";
import { Map } from "immutable";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as GatewayClient from "../gateway/client";

export const withOp =
  <K extends string>(key: K) =>
  <T>(data: T) =>
    [key, data] as const;

export type GuildMap = Map<Snowflake, APIGuild>;

export const watch$ = (
  dispatch$: GatewayClient.Client["dispatch$"],
): Rx.Observable<GuildMap> =>
  Rx.merge(
    Rx.of(["init"] as const),
    dispatch$(E.GuildCreate).pipe(RxO.map(withOp("create"))),
    dispatch$(E.GuildUpdate).pipe(RxO.map(withOp("update"))),
    dispatch$(E.GuildDelete).pipe(RxO.map(withOp("delete"))),
  ).pipe(
    RxO.scan((map, op) => {
      if (op[0] === "init") {
        return map;
      } else if (op[0] === "delete") {
        return map.delete(op[1].id);
      }

      const guild: APIGuild = { ...op[1] };

      // Un-reference some data that might be garbage collected later
      guild.roles = [];
      guild.emojis = [];
      delete guild.channels;
      delete guild.members;

      return map.set(guild.id, guild);
    }, Map<Snowflake, APIGuild>()),

    RxO.shareReplay(1),
  );
