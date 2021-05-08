require("dotenv").config();

import * as RxO from "rxjs/operators";
import { createClient, Intents } from "../src/mod";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  intents: Intents.GUILD_MESSAGES,
});

const command$ = client.command$("!");

command$({ name: "ping" })
  .pipe(RxO.flatMap(({ reply }) => reply("Pong!")))
  .subscribe();
