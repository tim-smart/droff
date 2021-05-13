# droff

Simple Discord client powered by RxJS and Axios

## Goals

- Lightweight - Simple Axios wrapper for the REST API with a lean Gateway API
  wrapper powered by RxJS.

## Install

```
yarn add droff discord-api-types
```

If you want more performance:

```
yarn add bufferutil
```

## Caching

Droff will only activate the caches that you use. So by default nothing is
cached.

Here are the caches available to use right now:

```typescript
import { createClient, Intents } from "../src/mod";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  // You will need to enable some intents for the caches to work
  intents: Intents.GUILD_EMOJIS | Intents.GUILD_MEMBERS,
});

// Here are the different caches that you can use. Each cache is an Observable
// which emits maps with the following structure:
//
// Map<GuildID, Map<ResourceID, Resource>>
//
// Where the `Resource` is the actual API object i.e. channel, role, member etc.
client.guilds$;
client.roles$;
client.channels$;
client.members$;
client.emojis$;
```

## Usage

This example creates a couple of slash commands:

```typescript
import { ApplicationCommandPermissionType } from "discord-api-types/v8";
import { createClient, Intents, Permissions } from "droff";
import * as RxO from "rxjs/operators";

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
    permissions: async (guild) =>
      guild.roles
        .filter((role) => BigInt(role.permissions) & Permissions.ADMINISTRATOR)
        .map((role) => ({
          id: role.id,
          type: ApplicationCommandPermissionType.ROLE,
          permission: true,
        })),
  })
  .pipe(
    RxO.flatMap(({ respond }) => respond({ content: "You are the special." })),
  )
  .subscribe();

commands.start();
```
