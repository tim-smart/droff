require("dotenv").config();

import * as RxO from "rxjs/operators";
import { createClient, Intents } from "../src/mod";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  intents: Intents.GUILD_MESSAGES,
});

const command$ = client.command$("!");

command$({ name: "role-check" })
  .pipe(
    // Append the guild and roles to the message
    client.withLatest({
      roles: client.roles$,
    })(({ message }) => message.guild_id),
    client.onlyWithGuild(),

    RxO.flatMap(([{ message, reply }, { roles }]) => {
      const memberRoles = message.member!.roles.map((id) => roles.get(id)!);
      const isAdmin = memberRoles.some((role) => role.name === "Admin");

      return isAdmin ? reply("Hi sir!") : reply("Nice try.");
    }),
  )
  .subscribe();
