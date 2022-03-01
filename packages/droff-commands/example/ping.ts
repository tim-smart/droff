require("dotenv").config();

import { createClient, Intents } from "droff";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as Commands from "../src/mod";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  gateway: {
    intents: Intents.GUILD_MESSAGES,
  },
});

const [guildsCache, guildsCache$] = client.guildsCache();

interface Metadata {
  description: string;
}

const command$ = Commands.create<Metadata>({ client, guildsCache });

const ping$ = command$({
  name: "ping",
  description: "A simple ping command",
}).pipe(RxO.flatMap(({ reply }) => reply({ content: "Pong!" })));

// Subscribe
Rx.merge(client.effects$, guildsCache$, ping$).subscribe();
