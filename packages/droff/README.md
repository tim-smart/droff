<div align="center">
  <br />
  <p>
    <img src="https://raw.githubusercontent.com/tim-smart/droff/main/assets/droff.svg" alt="droff" />
  </p>
</div>

[![Discord](https://img.shields.io/discord/887189613389705256?style=for-the-badge)](https://discord.gg/dtR2Mtu66Q)

Simple Discord client powered by RxJS and Axios

- API documentation: https://tim-smart.github.io/droff/droff/

## Goals

- Lightweight - Simple Axios wrapper for the REST API with a lean Gateway API
  wrapper powered by RxJS.
- Functional - Favour functional composition over inheritence. Every function or
  property on the client can be destructured and used without worrying about
  scope.

## Packages

| Name                                                                                           | Description                                                                                         |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [droff](https://github.com/tim-smart/droff/tree/main/packages/droff)                           | The core Discord client library                                                                     |
| [droff-interactions](https://github.com/tim-smart/droff/tree/main/packages/droff-interactions) | Accompanying library for interaction based components (slash commands, buttons, menus, selects etc) |
| [droff-commands](https://github.com/tim-smart/droff/tree/main/packages/droff-commands)         | Accompanying library to help implementing message based commands                                    |
| [droff-helpers](https://github.com/tim-smart/droff/tree/main/packages/droff-helpers)           | A collection of helper functions to make using droff easier                                         |
| [droff-redis](https://github.com/tim-smart/droff/tree/main/packages/droff-redis)               | An implementation of a Redis powered gateway proxy, cache store and rate limit store                |

## Install

```
yarn add droff
```

If you want more performance (erlpack not supported on Node 16):

```
yarn add bufferutil erlpack
```

## Usage

Basic ping example. Look at `droff-interactions` and `droff-commands` for
examples that work with slash commands etc.

Please note that you have to subscribe to `client.effects$` for the client to
function. This essentially starts the client.

```typescript
import { createClient, Intents } from "droff";
import * as Rx from "rxjs";
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
Rx.merge(client.effects$, pings$).subscribe();
```

## Gateway proxy

Larger bots may want to seperate the websocket handling from the bot logic, for
zero downtime deployments.

To do this you would pipe the gateway dispatch events into a event streaming
tool, like Apache Kafka or Rabbitmq, then subscribe to the events in your bot
logic.

See
[example/gateway-proxy.ts](https://github.com/tim-smart/droff/blob/main/packages/droff/example/gateway-proxy.ts)
for an example.

[Also see the Redis example.](https://github.com/tim-smart/droff/blob/main/packages/droff-redis/example/basic.ts)

## REST proxy

Larger bots may want to funnel all Discord HTTP requests through a single proxy server, to simplify rate limiting.

See [example/proxy.ts](https://github.com/tim-smart/droff/blob/main/packages/droff/example/proxy.ts) for an example.

## Caching

Droff will only activate the caches that you use. So by default nothing is
cached.

To use a cache, you call one of the cache factory methods, optionally passing in
a store implementation.

```typescript
import * as Rx from "rxjs";
import { createClient, Intents } from "../src/mod";

const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  gateway: {
    // You will need to enable some intents for the corresponding cache.
    intents: Intents.GUILD_EMOJIS | Intents.GUILD_MEMBERS,
  },
});

const [roleCache, roleCacheEffects$] = client.rolesCache();

// Subscribe to the cache effects if you want to populate the cache from the
// gateway events
Rx.merge(client.effects$, roleCacheEffects$).subscribe();

// You can then use the cache:
roleCache.getForParent("guild id xxx").then((map) => map.get("role id xxx"));
```

## What's missing

Just a heads up that is a relatively new client library. You should note that:

- There isn't much documentation
- There isn't anything implemented for Voice channels
- Some caches will be missing
- No benchmarking / optimization has been done at this point

Pull requests are more than welcome :)
