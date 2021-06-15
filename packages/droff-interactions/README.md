# droff-interactions

Accompanying library to `droff` for creating interaction based bots (slash
commands and buttons etc).

- API documentation: https://tim-smart.github.io/droff/droff-interactions/

## Usage

```typescript
import { createClient, Intents, Permissions } from "droff";
import {
  ApplicationCommandPermissionType,
  ButtonStyle,
  ComponentType,
} from "droff/dist/types";
import * as SlashCommands from "droff-interactions";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  gateway: {
    intents: Intents.GUILDS,
  },
});

const commands = SlashCommands.create(client);

// Global commands are for every guild.
// They can take up to an hour to show up.
const hello$ = commands
  .global({
    name: "hello",
    description: "A simple hello command",
  })
  .pipe(
    RxO.flatMap(({ respond, member }) =>
      respond({ content: `Hi there ${member!.user!.username}` }),
    ),
  );

// Guild commands can be enabled / disabled per guild.
// They show up instantly.
const ping$ = commands
  .guild({
    name: "ping",
    description: "A simple ping command",
  })
  .pipe(RxO.flatMap(({ respond }) => respond({ content: "Pong!" })));

const disabled$ = commands
  .guild({
    name: "disabled",
    description: "A disabled command. Will not show up in Discord.",
    enabled: (_guild) => Rx.of(false),
  })
  .pipe(RxO.flatMap(({ respond }) => respond({ content: "Pong!" })));

// You can set role or user level permissions
const admin$ = commands
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

        // Add some buttons
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
  );

// Button / component interaction
const button$ = commands
  .component("admin-button")
  .pipe(
    RxO.flatMap(({ respond }) =>
      respond({ content: "You clicked a button. wow.", flags: 64 }),
    ),
  );

// Subscribe
Rx.merge(
  client.effects$,
  commands.effects$,

  hello$,
  ping$,
  disabled$,
  admin$,

  button$,
).subscribe();
```
