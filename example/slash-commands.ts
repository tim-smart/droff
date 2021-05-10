require("dotenv").config();

import * as RxO from "rxjs/operators";
import { createClient, Intents } from "../src/mod";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  intents: Intents.GUILDS,
});

const commands = client.useSlashCommands();

commands
  .global({
    name: "hello",
    description: "A simple hello command",
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
