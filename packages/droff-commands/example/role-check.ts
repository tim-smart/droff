require("dotenv").config();

import { createClient, Intents } from "droff";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as Commands from "../src/mod";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  gateway: {
    intents: Intents.GUILD_MESSAGES,
  },
});

const command$ = Commands.create(client);

const roleCheck$ = command$({
  name: "role-check",
  help: ({ reply }) => reply({ content: "Help message" }),
}).pipe(
  // Append the guild and roles to the message
  client.withCaches({
    roles: client.roles$,
  })(({ message }) => message.guild_id),
  client.onlyWithGuild(),

  RxO.flatMap(([{ message, reply }, { guild, roles }]) => {
    const memberRoles = message.member!.roles.map((id) => roles.get(id)!);
    const isAdmin = memberRoles.some((role) => role.name === "Admin");
    const isOwner = guild.owner_id === message.author.id;

    return isAdmin || isOwner
      ? reply({ content: "Hi sir!" })
      : reply({ content: "Nice try." });
  }),
);

// Subscribe
Rx.merge(client.effects$, roleCheck$).subscribe();
