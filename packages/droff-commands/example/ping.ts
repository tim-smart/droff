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

// Debug mode. Trigger with `kill -SIGUSR2 {pid}`
Rx.fromEvent(process, "SIGUSR2")
  .pipe(RxO.first())
  .subscribe(() => {
    client.gateway.raw$.subscribe(console.log);
  });

const command$ = Commands.create(client)("!");

command$({ name: "ping" })
  .pipe(RxO.flatMap(({ reply }) => reply("Pong!")))
  .subscribe();
