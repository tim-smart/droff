# droff

Simple Discord client powered by RxJS and Axios

## Goals

- Lightweight - Simple Axios wrapper for the REST API with a lean Gateway API
  wrapper powered by RxJS.
- Functional - Favour functional composition over inheritence. Every function or
  property on the client can be destructured and used without worrying about
  scope.

## Packages

| Name                                                                                           | Description                                                      |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [droff](https://github.com/tim-smart/droff/tree/main/packages/droff)                           | The core Discord client library                                  |
| [droff-interactions](https://github.com/tim-smart/droff/tree/main/packages/droff-interactions) | Accompanying library for using slash commands and buttons        |
| [droff-commands](https://github.com/tim-smart/droff/tree/main/packages/droff-command)          | Accompanying library to help implementing message based commands |

## Install

```
yarn add droff
```

If you want more performance (erlpack not supported on Node 16):

```
yarn add bufferutil erlpack
```

## What's missing

Just a heads up that is a relatively new client library. You should note that:

- There isn't much documentation
- There isn't anything implemented for Voice channels
- Some caches will be missing
- No benchmarking / optimization has been done at this point

Pull requests are more than welcome :)

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
import { createClient, Intents, Permissions } from "droff";
import {
  ApplicationCommandPermissionType,
  ButtonStyle,
  ComponentType,
} from "droff/dist/types";
import * as Rx from "rxjs";
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
      respond({ content: `Hi there ${member!.user!.username}` }),
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
    enabled: (_guild) => Rx.of(false),
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
      Rx.from(client.getGuildRoles(guild.id)).pipe(
        // Permissions for roles with ADMINISTRATOR enabled
        RxO.flatMap((roles) =>
          roles
            .filter(
              (role) => BigInt(role.permissions) & Permissions.ADMINISTRATOR,
            )
            .map((role) => ({
              id: role.id,
              type: ApplicationCommandPermissionType.ROLE,
              permission: true,
            }))
            .values(),
        ),

        // Add permissions for the guild owner
        RxO.startWith({
          id: guild.owner_id,
          type: ApplicationCommandPermissionType.USER,
          permission: true,
        }),
      ),
  })
  .pipe(
    RxO.flatMap(({ respond }) =>
      respond({
        content: "You are the special.",
        components: [
          {
            type: ComponentType.ACTION_ROW,
            components: [
              {
                type: ComponentType.BUTTON,
                label: "Here is a button",
                custom_id: "admin-button",
                style: ButtonStyle.PRIMARY,
              },
            ],
          },
        ],
      }),
    ),
  )
  .subscribe();

commands
  .component("admin-button")
  .pipe(
    RxO.flatMap(({ respond }) =>
      respond({ content: "You clicked a button. wow." }),
    ),
  )
  .subscribe();

commands.start();
```
