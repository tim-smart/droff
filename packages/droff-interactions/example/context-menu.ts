require("dotenv").config();

import { createClient } from "droff";
import {
  ApplicationCommandType,
  InteractionCallbackType,
  InteractionType,
  MessageFlag,
} from "droff/types";
import { pipe } from "fp-ts/lib/function";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as Interactions from "../src/mod";
import { UI, Ix } from "../../droff-helpers/src/mod";
import { toUndefined } from "fp-ts/lib/Option";

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
  RxO.flatMap(({ respond }) =>
    respond(InteractionCallbackType.MODAL)({
      custom_id: "echo-modal",
      title: "Echo",
      components: UI.singleColumn([
        UI.textInput({
          custom_id: "text",
          label: "Text",
        }),
      ]),
    }),
  ),
);

const getText = Ix.componentValue("text");

I.interaction(InteractionType.MODAL_SUBMIT)
  .pipe(
    Interactions.filterByCustomId("echo-modal"),
    RxO.flatMap(({ respond, interaction }) =>
      respond(4)({
        content: toUndefined(getText(interaction)),
        flags: MessageFlag.EPHEMERAL,
      }),
    ),
  )
  .subscribe();

// Subscribe
Rx.merge(client.effects$, I.sync$, echo$).subscribe();
