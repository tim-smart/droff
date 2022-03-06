require("dotenv").config();

import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Subject } from "rxjs";
import { createClient, Intents } from "../src/mod";
import { GatewayPayload } from "../src/types";

// First push the dispatch events into your event streaming tool.
// Here we will use a rxjs subject.
const stream = new Subject<GatewayPayload>();
const sourceClient = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  gateway: {
    intents: Intents.GUILD_MESSAGES,
  },
});

// Push the dispatch events into the stream
sourceClient.dispatch$.subscribe(stream);
sourceClient.effects$.subscribe();

// In your bot logic you then replace the gateway payloads source with a custom
// one.
const childClient = createClient({
  // The token will only be used for the REST API here.
  token: process.env.DISCORD_BOT_TOKEN!,
  gateway: { payloads$: stream },
});

// You can then use the client like normal.
const ping$ = childClient.fromDispatch("MESSAGE_CREATE").pipe(
  RxO.filter((msg) => msg.author.bot !== true),
  RxO.filter((msg) => msg.content === "!ping"),
  RxO.flatMap((msg) =>
    childClient.createMessage(msg.channel_id, {
      message_reference: { message_id: msg.id },
      content: "Pong!",
    }),
  ),
);

Rx.merge(childClient.effects$, ping$).subscribe();
