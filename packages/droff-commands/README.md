# `droff-commands`

Accompanying library to `droff` for creating message based commands.

It uses [lexure](https://github.com/1Computer1/lexure) for parsing commands.

## Usage

```typescript
import { createClient, Intents } from "droff";
import * as Commands from "droff-commands";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  gateway: {
    intents: Intents.GUILD_MESSAGES,
  },
});

const command$ = Commands.create(client)("!");

const ping$ = command$({ name: "ping" }).pipe(
  RxO.flatMap(({ reply }) => reply("Pong!")),
);

// Subscribe
Rx.merge(client.effects$, ping$).subscribe();
```
