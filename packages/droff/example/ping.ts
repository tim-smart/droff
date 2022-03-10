require("dotenv").config();

import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { createClient, Intents } from "../src/mod";
import { ActivityType, StatusType } from "../src/types";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  gateway: {
    intents: Intents.GUILD_MESSAGES,
    presence: {
      activities: [
        {
          type: ActivityType.WATCHING,
          name: "prefix !",
          created_at: Date.now(),
        },
      ],
      afk: false,
      status: StatusType.ONLINE,
      since: null,
    },
  },
});

const pings$ = client.fromDispatch("MESSAGE_CREATE").pipe(
  RxO.filter((msg) => msg.author.bot !== true),
  RxO.filter((msg) => msg.content === "!ping"),
  RxO.flatMap((msg) =>
    client.createMessage(msg.channel_id, {
      message_reference: { message_id: msg.id },
      content: "Pong!",
    }),
  ),
);

// Subscribe
Rx.merge(client.effects$, pings$).subscribe();
