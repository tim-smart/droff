require("dotenv").config();

import { createClient } from "droff";
import {
  ApplicationCommandOptionType,
  InteractionCallbackType,
  InteractionType,
  MessageFlag,
} from "droff/types";
import { flow } from "fp-ts/lib/function";
import { toUndefined } from "fp-ts/lib/Option";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as H from "../../droff-helpers";
import * as Ix from "../src/mod";

const client = createClient({ token: process.env.DISCORD_BOT_TOKEN! });
const ix = Ix.create(client);

// Global commands are for every guild.
// They can take up to an hour to show up.
const hello$ = ix
  .global({
    name: "hello",
    description: "A simple hello command",
  })
  .pipe(
    RxO.flatMap(({ respond, member }) =>
      respond(InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE)({
        content: `Hi there ${member!.user!.username}`,
      }),
    ),
  );

// Command with autocomplete
const getCountry = flow(H.Ix.optionValue("name"), toUndefined);
const countries$ = ix
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
      respond(InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE)({
        content: `You chose the country: ${getCountry(interaction)}`,
      }),
    ),
  );

// Add the autocomplete handler
const countryAutocomplete$ = ix
  .interaction(InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE)
  .pipe(
    Ix.filterByName("country"),
    Ix.filterByFocusedOption("name"),

    RxO.flatMap(({ respond, focusedOption }) =>
      respond(InteractionCallbackType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT)({
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
const ping$ = ix
  .guild({
    name: "ping",
    description: "A simple ping command",
  })
  .pipe(
    RxO.flatMap(({ respond }) =>
      respond(InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE)({
        content: "Pong!",
      }),
    ),
  );

const disabled$ = ix
  .guild({
    name: "disabled",
    description: "A disabled command. Will not show up in Discord.",
    enabled: (_guild) => Rx.of(false),
  })
  .pipe(
    RxO.flatMap(({ respond }) =>
      respond(InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE)({
        content: "Pong!",
      }),
    ),
  );

// You can set role or user level permissions
const admin$ = ix
  .guild({
    name: "admin-only",
    description: "A restricted command",
    default_member_permissions: "0",
  })
  .pipe(
    RxO.flatMap(({ respond }) =>
      respond(InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE)({
        content: "You are the special.",

        // Add some buttons
        components: H.UI.grid([
          [
            H.UI.button({
              custom_id: "admin-button",
              label: "Here is a button",
            }),
          ],
        ]),
      }),
    ),
  );

// Button / component interaction
const button$ = ix.interaction(InteractionType.MESSAGE_COMPONENT).pipe(
  Ix.filterByCustomId("admin-button"),

  RxO.flatMap(({ respond }) =>
    respond(InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE)({
      content: "You clicked a button. wow.",
      flags: MessageFlag.EPHEMERAL,
    }),
  ),
);

// Modals
const greeting$ = ix
  .guild({
    name: "greeting",
    description: "Give a nice greeting :)",
  })
  .pipe(
    RxO.flatMap(({ respond }) =>
      respond(InteractionCallbackType.MODAL)({
        custom_id: "greeting-modal",
        title: "What is your name?",
        components: H.UI.singleColumn([
          H.UI.textInput({
            custom_id: "name",
            label: "Name",
          }),
        ]),
      }),
    ),
  );

const getName = flow(H.Ix.componentValue("name"), toUndefined);

const greetingModal$ = ix.interaction(InteractionType.MODAL_SUBMIT).pipe(
  Ix.filterByCustomId("greeting-modal"),

  RxO.flatMap(({ respond, interaction }) =>
    respond(InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE)({
      content: `Hello there ${getName(interaction)}`,
    }),
  ),
);

// Subscribe
Rx.merge(
  client.effects$,
  ix.sync$,

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
