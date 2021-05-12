import {
  APIGuild,
  GatewayDispatchEvents as E,
  Snowflake,
} from "discord-api-types/v8";
import { Map } from "immutable";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as GatewayClient from "../gateway/client";
import { Routes } from "../rest/client";

const withOp =
  <K extends string>(key: K) =>
  <T>(data: T) =>
    [key, data] as const;

const updateGuild =
  (fetch: (guildID: Snowflake) => Promise<Partial<APIGuild>>) =>
  () =>
  (source$: Rx.Observable<{ guild_id?: Snowflake }>) =>
    source$.pipe(
      RxO.filter((d): d is { guild_id: Snowflake } => !!d.guild_id),
      RxO.flatMap(({ guild_id }) =>
        fetch(guild_id).then((guild) => ({
          id: guild_id,
          ...guild,
        })),
      ),
      RxO.map(withOp("update")),
    );

export const watch$ = (
  dispatch$: GatewayClient.Client["dispatch$"],
  rest: Routes,
) => {
  const updateChannels = updateGuild((id) =>
    rest.getGuildChannels([id]).then((channels) => ({
      channels,
    })),
  );
  const updateRoles = updateGuild((id) =>
    rest.getGuildRoles([id]).then((roles) => ({
      roles,
    })),
  );

  return Rx.merge(
    Rx.of(["init"] as const),
    dispatch$(E.GuildCreate).pipe(RxO.map(withOp("create"))),
    dispatch$(E.GuildUpdate).pipe(RxO.map(withOp("update"))),
    dispatch$(E.GuildDelete).pipe(RxO.map(withOp("delete"))),

    // Update guilds when channels change
    dispatch$(E.ChannelCreate).pipe(updateChannels()),
    dispatch$(E.ChannelUpdate).pipe(updateChannels()),
    dispatch$(E.ChannelDelete).pipe(updateChannels()),

    // Update guilds when roles change
    dispatch$(E.GuildRoleCreate).pipe(updateRoles()),
    dispatch$(E.GuildRoleUpdate).pipe(updateRoles()),
    dispatch$(E.GuildRoleDelete).pipe(updateRoles()),

    // Update guilds when emojis change
    dispatch$(E.GuildEmojisUpdate).pipe(
      RxO.map(({ guild_id, emojis }) => ({
        id: guild_id,
        emojis,
      })),
      RxO.map(withOp("update")),
    ),
  ).pipe(
    RxO.scan((map, op) => {
      if (op[0] === "init") {
        return map;
      } else if (op[0] === "update") {
        return map.update(op[1].id!, (guild) => ({
          ...guild,
          ...op[1],
        }));
      }

      return op[0] === "delete"
        ? map.delete(op[1].id)
        : map.set(op[1].id, op[1]);
    }, Map<Snowflake, APIGuild>()),
    RxO.shareReplay(1),
  );
};
