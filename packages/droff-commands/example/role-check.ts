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
const [guildCache, guildCache$] = client.guildsCache();
const [roleCache, roleCache$] = client.rolesCache();

const command$ = Commands.create(client, { guildCache: guildCache });

const roleCheck$ = command$({
  name: "role-check",
  help: ({ reply }) => reply({ content: "Help message" }),
}).pipe(
  client.withCaches({ roles: roleCache })(({ guild }) => guild?.id),
  client.onlyWithCacheResults(),

  RxO.flatMap(([{ message, reply, guild }, { roles }]) => {
    const memberRoles = message.member!.roles.map((id) => roles.get(id)!);
    const isAdmin = memberRoles.some((role) => role.name === "Admin");
    const isOwner = guild!.owner_id === message.author.id;

    return isAdmin || isOwner
      ? reply({ content: "Hi sir!" })
      : reply({ content: "Nice try." });
  }),
);

// Subscribe
Rx.merge(client.effects$, guildCache$, roleCache$, roleCheck$).subscribe();
