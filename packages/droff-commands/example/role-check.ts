require("dotenv").config();

import * as RxO from "rxjs/operators";
import { createClient, Intents } from "droff";
import * as Commands from "../src/mod";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  gateway: {
    intents: Intents.GUILD_MESSAGES,
  },
});

const command$ = Commands.create(client)("!");

command$({ name: "role-check" })
  .pipe(
    // Append the guild and roles to the message
    client.withCaches({
      roles: client.roles$,
    })(({ message }) => message.guild_id),
    client.onlyWithGuild(),

    RxO.flatMap(([{ message, reply }, { guild, roles }]) => {
      const memberRoles = message.member!.roles.map((id) => roles.get(id)!);
      const isAdmin = memberRoles.some((role) => role.name === "Admin");
      const isOwner = guild.owner_id === message.author.id;

      return isAdmin || isOwner ? reply("Hi sir!") : reply("Nice try.");
    }),
  )
  .subscribe();
