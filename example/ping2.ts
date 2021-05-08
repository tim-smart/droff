require("dotenv").config();

import * as RxO from "rxjs/operators";
import { createClient, Events, Intents } from "../src/mod";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  intents: Intents.GUILD_MESSAGES,
});

client
  .dispatch$(Events.MessageCreate)
  .pipe(
    RxO.filter((msg) => msg.content === "!ping"),
    RxO.flatMap((msg) =>
      client.postChannelMessages([msg.channel_id], {
        message_reference: { message_id: msg.id },
        content: "Pong!",
      }),
    ),
  )
  .subscribe();
