require("dotenv").config();

import { ApplicationCommandPermissionType } from "discord-api-types/v8";
import * as RxO from "rxjs/operators";
import { createClient, Intents, Permissions } from "../src/mod";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  intents: Intents.GUILDS,
});

const commands = client.useSlashCommands();

// Global commands are for every guild.
// They can take up to an hour to show up.
commands
  .global({
    name: "hello",
    description: "A simple hello command",
  })
  .pipe(
    RxO.flatMap(({ respond, member }) =>
      respond({ content: `Hi there ${member!.user.username}` }),
    ),
  )
  .subscribe();

// Guild commands can be enabled / disabled per guild.
// They show up instantly.
commands
  .guild({
    name: "ping",
    description: "A simple ping command",
  })
  .pipe(RxO.flatMap(({ respond }) => respond({ content: "Pong!" })))
  .subscribe();

commands
  .guild({
    name: "disabled",
    description: "A disabled command. Will not show up in Discord.",
    enabled: async (_guild) => false,
  })
  .pipe(RxO.flatMap(({ respond }) => respond({ content: "Pong!" })))
  .subscribe();

// You can set role or user level permissions
commands
  .guild({
    name: "admin-only",
    description: "A restricted command",
    default_permission: false,
    permissions: (guild) =>
      client
        .getGuildRoles([guild.id])
        // Allow any role with the ADMINISTRATOR permission
        .then((roles) =>
          roles
            .filter(
              (role) => BigInt(role.permissions) & Permissions.ADMINISTRATOR,
            )
            .map((role) => ({
              id: role.id,
              type: ApplicationCommandPermissionType.ROLE,
              permission: true,
            })),
        )
        // Also allow the owner
        .then((permissions) => [
          ...permissions,
          {
            id: guild.owner_id,
            type: ApplicationCommandPermissionType.USER,
            permission: true,
          },
        ]),
  })
  .pipe(
    RxO.flatMap(({ respond }) => respond({ content: "You are the special." })),
  )
  .subscribe();

commands.start();
