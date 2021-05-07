require("dotenv").config();

import { RESTGetAPIGuildInvitesResult, Routes } from "discord-api-types/v8";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { createClient, Events, Intents } from "../";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  intents: Intents.GUILDS | Intents.GUILD_MEMBERS | Intents.GUILD_INVITES,
});

client
  .dispatch$(Events.GuildMemberAdd)
  .pipe(
    RxO.flatMap((data) =>
      Rx.zip(
        Rx.of(data),
        Rx.of(client.guilds$.value.get(data.guild_id)),
        client.getGuildInvites([data.guild_id]),
      ),
    ),
  )
  .subscribe(([data, guild, invites]) => {
    console.log(data, guild, invites);
  });
