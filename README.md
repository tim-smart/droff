# droff

A Discord client powered by RxJS and `discord-api-types`

## Goals

- Lightweight - Simple Axios wrapper for the REST API with a lean Gateway API
  wrapper powered by RxJS.

## Install

```
yarn add droff discord-api-types
```

If you want more performance:

```
yarn add bufferutil
```

## Usage

A simple `!ping` command example :)

Using the `command$` function:

```typescript
import * as RxO from "rxjs/operators";
import { createClient, Intents } from "droff";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  intents: Intents.GUILD_MESSAGES,
});

const command$ = client.command$("!");

command$({ name: "ping" })
  .pipe(
    RxO.flatMap(({ message }) =>
      client.postChannelMessages([message.channel_id], {
        message_reference: { message_id: message.id },
        content: "Pong!",
      }),
    ),
  )
  .subscribe();
```

Without using the `command$` function:

```typescript
import * as RxO from "rxjs/operators";
import { createClient, Events, Intents } from "droff";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  intents: Intents.GUILD_MESSAGES,
});

client
  .dispatch$(Events.MessageCreate)
  .pipe(
    RxO.filter((m) => m.content === "!ping"),
    RxO.flatMap((m) =>
      client.postChannelMessages([m.channel_id], {
        message_reference: {
          message_id: m.id,
        },
        content: "Pong!",
      }),
    ),
  )
  .subscribe();
```
