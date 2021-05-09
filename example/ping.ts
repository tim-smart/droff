require("dotenv").config();

import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { createClient, Intents } from "../src/mod";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  intents: Intents.GUILD_MESSAGES,
});

// Debug mode. Trigger with `kill -SIGUSR2 {pid}`
Rx.fromEvent(process, "SIGUSR2")
  .pipe(RxO.first())
  .subscribe(() => {
    client.gateway.shards.forEach((shard) => {
      shard.raw$.subscribe(console.log);
    });
  });

const command$ = client.command$("!");

command$({ name: "ping" })
  .pipe(RxO.flatMap(({ reply }) => reply("Pong!")))
  .subscribe();
