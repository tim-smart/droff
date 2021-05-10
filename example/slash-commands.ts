require("dotenv").config();

import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { createClient, Intents } from "../src/mod";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  intents: Intents.GUILDS,
});

// Debug mode. Trigger with `kill -SIGUSR2 {pid}`
Rx.fromEvent(process, "SIGUSR2")
  .pipe(RxO.first())
  .subscribe(() => {
    client.gateway.shards.forEach((shard) => {
      shard.raw$.subscribe(console.log);
    });
  });

const commands = client.useSlashCommands();

commands
  .guild({
    name: "hello",
    description: "A simple hello command",
    enabled: async () => true,
  })
  .pipe(
    RxO.flatMap(({ respond, member }) =>
      respond({ content: `Hi there ${member!.user.username}` }),
    ),
  )
  .subscribe();

commands
  .guild({
    name: "ping",
    description: "A simple ping command",
    enabled: async () => true,
  })
  .pipe(RxO.flatMap(({ respond }) => respond({ content: "Pong!" })))
  .subscribe();

commands.start();
