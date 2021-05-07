require("dotenv").config();

import * as RxO from "rxjs/operators";
import { createClient, Events, Intents } from "../";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  intents: Intents.GUILD_MESSAGES,
});

client
  .dispatch$(Events.MessageCreate)
  .pipe(
    RxO.filter((m) => m.content === "!ping"),
    RxO.flatMap((m) =>
      client.postChannelMessages([m.channel_id], {
        message_reference: {
          message_id: m.id,
        },
        content: "Pong!",
      }),
    ),
  )
  .subscribe();
