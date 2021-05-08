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
  .pipe(RxO.flatMap(({ reply }) => reply("Pong!")))
  .subscribe();

setTimeout(() => client.gateway.reconnect(), 10000);
```

Without using the `command$` function:

```typescript
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { createClient, Events, Intents } from "droff";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  intents: Intents.GUILDS | Intents.GUILD_MEMBERS | Intents.GUILD_INVITES,
});

client
  .dispatch$(Events.GuildMemberAdd)
  .pipe(
    RxO.withLatestFrom(client.guilds$),
    RxO.flatMap(([data, guilds]) =>
      Rx.zip(
        Rx.of(data),
        Rx.of(guilds.get(data.guild_id)),
        client.getGuildInvites([data.guild_id]),
      ),
    ),
  )
  .subscribe(([data, guild, invites]) => {
    console.log(data, guild, invites);
  });
```
