# droff

Simple Discord client powered by RxJS and Axios

- API documentation: https://tim-smart.github.io/droff/droff/

## Goals

- Lightweight - Simple Axios wrapper for the REST API with a lean Gateway API
  wrapper powered by RxJS.
- Functional - Favour functional composition over inheritence. Every function or
  property on the client can be destructured and used without worrying about
  scope.

## Packages

| Name                                                                                           | Description                                                      |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [droff](https://github.com/tim-smart/droff/tree/main/packages/droff)                           | The core Discord client library                                  |
| [droff-interactions](https://github.com/tim-smart/droff/tree/main/packages/droff-interactions) | Accompanying library for using slash commands and buttons        |
| [droff-commands](https://github.com/tim-smart/droff/tree/main/packages/droff-commands)         | Accompanying library to help implementing message based commands |
| [droff-helpers](https://github.com/tim-smart/droff/tree/main/packages/droff-helpers)           | A collection of helper functions to make using droff easier      |

## Install

```
yarn add droff
```

If you want more performance (erlpack not supported on Node 16):

```
yarn add bufferutil erlpack
```

## What's missing

Just a heads up that is a relatively new client library. You should note that:

- There isn't much documentation
- There isn't anything implemented for Voice channels
- Some caches will be missing
- No benchmarking / optimization has been done at this point

Pull requests are more than welcome :)

## Caching

Droff will only activate the caches that you use. So by default nothing is
cached.

Here are the caches available to use right now:

```typescript
import { createClient, Intents } from "../src/mod";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  // You will need to enable some intents for the caches to work
  intents: Intents.GUILD_EMOJIS | Intents.GUILD_MEMBERS,
});

// Here are the different caches that you can use. Each cache is an Observable
// which emits maps with the following structure:
//
// Map<GuildID, Map<ResourceID, Resource>>
//
// Where the `Resource` is the actual API object i.e. channel, role, member etc.
client.guilds$;
client.roles$;
client.channels$;
client.members$;
client.emojis$;
```

## Usage

Basic ping example. Look at `droff-interactions` and `droff-commands` for
examples that work with slash commands etc.

Please note that you have to subscribe to `client.effects$` for the client to
function. This essentially starts the client.

```typescript
import { createClient, Intents } from "droff";
import * as RxO from "rxjs/operators";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  gateway: {
    intents: Intents.GUILD_MESSAGES,
  },
});

const pings$ = client.fromDispatch("MESSAGE_CREATE").pipe(
  RxO.filter((msg) => msg.content === "!ping"),
  RxO.flatMap((msg) =>
    client.createMessage(msg.channel_id, {
      message_reference: { message_id: msg.id },
      content: "Pong!",
    }),
  ),
);

// Subscribe to our side effects
pings$.subscribe();
client.effects$.subscribe();
```
