require("dotenv").config();

import { createClient } from "droff";
import {
  ApplicationCommandType,
  InteractionCallbackType,
  MessageFlag,
} from "droff/types";
import { pipe } from "fp-ts/lib/function";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as Interactions from "../src/mod";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
});

const I = Interactions.create(client);

// Echo menu item
const echo$ = pipe(
  I.guild({
    type: ApplicationCommandType.MESSAGE,
    name: "Echo",
    description: "",
  }),
  RxO.flatMap(({ targetMessage, respond }) =>
    respond(InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE)({
      content: targetMessage!.content,
      flags: MessageFlag.EPHEMERAL,
    }),
  ),
);

// Subscribe
Rx.merge(client.effects$, I.effects$, echo$).subscribe();
