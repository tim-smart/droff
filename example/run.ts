require("dotenv").config();

import {
  GatewayDispatchEvents as Events,
  GatewayIntentBits,
  RESTGetAPIGuildInvitesResult,
  Routes,
} from "discord-api-types/v8";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Client } from "../";

const client = Client.create({
  token: process.env.DISCORD_BOT_TOKEN!,
  intents:
    GatewayIntentBits.GUILDS |
    GatewayIntentBits.GUILD_MEMBERS |
    GatewayIntentBits.GUILD_INVITES,
});

client
  .dispatch$(Events.GuildMemberAdd)
  .pipe(
    RxO.flatMap((data) =>
      Rx.zip(
        Rx.of(data),
        Rx.of(client.guilds$.value.get(data.guild_id)),
        client
          .get<RESTGetAPIGuildInvitesResult>(Routes.guildInvites(data.guild_id))
          .then((r) => r.data),
      ),
    ),
  )
  .subscribe(([data, guild, invites]) => {
    console.log(data, guild, invites);
  });
