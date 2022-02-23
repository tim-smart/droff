require("dotenv").config();

import { createClient, Intents, Permissions } from "droff";
import {
  ApplicationCommandOptionType,
  ApplicationCommandPermissionType,
  MessageFlag,
} from "droff/dist/types";
import { flow } from "fp-ts/lib/function";
import { toUndefined } from "fp-ts/lib/Option";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Interactions as Helpers, UI } from "../../droff-helpers";
import * as Interactions from "../src/mod";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  gateway: {
    intents: Intents.GUILDS,
  },
});

const commands = Interactions.create(client);

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

// Command with autocomplete
const getCountry = flow(Helpers.optionValue("name"), toUndefined);
const countries$ = commands
  .guild({
    name: "country",
    description: "A simple country command",
    options: [
      {
        type: ApplicationCommandOptionType.STRING,
        name: "name",
        description: "The name of the country",
        autocomplete: true,
      },
    ],
  })
  .pipe(
    RxO.flatMap(({ interaction, respond }) =>
      respond({
        content: `You chose the country: ${getCountry(interaction)}`,
      }),
    ),
  );

// Add the autocomplete handler
const countryAutocomplete$ = commands.autocomplete("country", "name").pipe(
  RxO.flatMap(({ autocomplete, focusedOption }) =>
    autocomplete({
      choices: [
        {
          name: `Other: ${focusedOption!.value}`,
          value: `Other: ${focusedOption!.value}`,
        },
        {
          name: "New Zealand",
          value: "New Zealand",
        },
        {
          name: "United States",
          value: "USA",
        },
      ],
    }),
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
        components: UI.singleColumn([
          UI.button({
            custom_id: "admin-button",
            label: "Here is a button",
          }),
        ]),
      }),
    ),
  );

// Button / component interaction
const button$ = commands.component("admin-button").pipe(
  RxO.flatMap(({ respond }) =>
    respond({
      content: "You clicked a button. wow.",
      flags: MessageFlag.EPHEMERAL,
    }),
  ),
);

// Modals
const greeting$ = commands
  .guild({
    name: "greeting",
    description: "Give a nice greeting :)",
  })
  .pipe(
    RxO.flatMap(({ modal }) =>
      modal({
        custom_id: "greeting-modal",
        title: "What is your name?",
        components: UI.grid([
          [
            UI.textInput({
              custom_id: "name",
              label: "Name",
            }),
          ],
        ]),
      }),
    ),
  );

const getName = flow(Helpers.componentValue("name"), toUndefined);

const greetingModal$ = commands
  .modalSubmit("greeting-modal")
  .pipe(
    RxO.flatMap(({ respond, interaction }) =>
      respond({ content: `Hello there ${getName(interaction)}` }),
    ),
  );

// Subscribe
Rx.merge(
  client.effects$,
  commands.effects$,

  hello$,
  countries$,
  countryAutocomplete$,
  ping$,
  disabled$,
  admin$,
  greeting$,

  button$,
  greetingModal$,
).subscribe();
