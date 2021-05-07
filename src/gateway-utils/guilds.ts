import { GatewayDispatchEvents as E } from "discord-api-types/gateway/v8";
import { Snowflake } from "discord-api-types/globals";
import { APIGuild } from "discord-api-types/payloads/v8";
import { Map } from "immutable";
import * as Rx from "rxjs";
import * as GatewayClient from "../gateway/client";

export const watch$ = (dispatch$: GatewayClient.Client["dispatch$"]) => {
  const guilds = new Rx.BehaviorSubject<Map<Snowflake, APIGuild>>(Map());

  dispatch$(E.GuildCreate).subscribe((guild) => {
    guilds.next(guilds.value.set(guild.id, guild));
  });

  dispatch$(E.GuildUpdate).subscribe((guild) => {
    guilds.next(guilds.value.set(guild.id, guild));
  });

  dispatch$(E.GuildDelete).subscribe((guild) => {
    guilds.next(guilds.value.delete(guild.id));
  });

  return guilds;
};
