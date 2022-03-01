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
const [guildsCache, guildsCache$] = client.guildsCache();
const [rolesCache, rolesCache$] = client.rolesCache();

interface CommandMeta {
  description: string;
}

const command = Commands.create<CommandMeta>({ client, guildsCache });

const help$ = command({
  name: "help",
  description: "You are looking at it",
}).pipe(
  RxO.flatMap(({ commands, reply, prefix }) =>
    reply({
      content: [...commands.values()]
        .map(({ name, description }) => `**${prefix}${name}**: ${description}`)
        .join("\n"),
    }),
  ),
);

const roleCheck$ = command({
  name: "role-check",
  description: "Checks if you are an admin",
}).pipe(
  client.withCaches({ roles: rolesCache.getForParent })(
    ({ guild }) => guild?.id,
  ),
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
Rx.merge(
  client.effects$,
  guildsCache$,
  rolesCache$,
  help$,
  roleCheck$,
).subscribe();
