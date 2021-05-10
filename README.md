# droff

Simple Discord client powered by RxJS and Axios

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

This example creates a couple of slash commands:

```typescript
import { createClient, Intents } from "droff";
import * as RxO from "rxjs/operators";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  intents: Intents.GUILDS,
});

const commands = client.useSlashCommands();

// Global slash commands are enabled for every guild
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

// Guild commands can be enabled / disabled per guild
commands
  .guild({
    name: "ping",
    description: "A simple ping command",
    enabled: async () => true,
  })
  .pipe(RxO.flatMap(({ respond }) => respond({ content: "Pong!" })))
  .subscribe();

commands.start();
```
