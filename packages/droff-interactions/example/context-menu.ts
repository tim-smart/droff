require("dotenv").config();

import { createClient, Intents } from "droff";
import { ApplicationCommandType, MessageFlag } from "droff/dist/types";
import { pipe } from "fp-ts/lib/function";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as Interactions from "../src/mod";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  gateway: {
    intents: Intents.GUILDS,
  },
});

const I = Interactions.create(client);

// Echo menu item
const echo$ = pipe(
  I.guild({
    type: ApplicationCommandType.MESSAGE,
    name: "Echo",
    description: "",
  }),
  RxO.flatMap(({ interaction, respond }) =>
    respond({
      content:
        interaction.data!.resolved!.messages![interaction!.data!.target_id!]
          .content,
      flags: MessageFlag.EPHEMERAL,
    }),
  ),
);

// Subscribe
Rx.merge(client.effects$, I.effects$, echo$).subscribe();
