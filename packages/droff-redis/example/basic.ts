require("dotenv").config();

import * as Redis from "redis";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { createClient, Intents } from "../../droff";
import { createStores } from "../src/mod";

// Redis client
const redisClient = Redis.createClient();
redisClient.connect();

// Create the redis store factories
const redis = createStores({ client: redisClient });

// Parent client
const sourceClient = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  // Use the redis backed rate limit store
  rateLimitStore: redis.rateLimit(),
  gateway: {
    intents: Intents.GUILD_MESSAGES,
    // shardConfig: { count: 10 },
    sharderStore: redis.sharder("test-deploy", `${Date.now()}`),
  },
});

// Push the gateway events to redis
const push$ = redis.pushPayloads(sourceClient);

// Cache some resources in redis
const [, guildsCache$] = sourceClient.guildsCache(
  redis.nonParentCache("guilds"),
);
const [, rolesCache$] = sourceClient.rolesCache(
  redis.cacheWithTTL("roles", 20000),
);
const [, channelsCache$] = sourceClient.channelsCache(redis.cache("channels"));

// Start the source client
Rx.merge(
  sourceClient.effects$,
  push$,
  guildsCache$,
  rolesCache$,
  channelsCache$,
).subscribe();

// === Child clients

// Setup the client, using redis as the gateway payloads source
const childClient = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  rateLimitStore: redis.rateLimit(),
  gatewayPayloads$: redis.pullPayloads(),
});

// Use a shared cache
const [rolesCache, childRolesCache$] = childClient.rolesCache(
  redis.cacheWithTTL("roles", 20000),
);

const roles$ = childClient.fromDispatch("MESSAGE_CREATE").pipe(
  RxO.filter((msg) => msg.author.bot !== true),
  RxO.filter((msg) => msg.content === "!roles"),

  childClient.withCaches({
    roles: rolesCache.getForParent,
  })((msg) => msg.guild_id),
  childClient.onlyWithCacheResults(),

  RxO.flatMap(([msg, { roles }]) =>
    childClient.createMessage(msg.channel_id, {
      message_reference: { message_id: msg.id },
      content: JSON.stringify([...roles.values()], null, 2),
    }),
  ),
);

const roleCount$ = childClient.fromDispatch("MESSAGE_CREATE").pipe(
  RxO.filter((msg) => msg.author.bot !== true),
  RxO.filter((msg) => msg.content === "!rolecount"),

  childClient.withCaches({
    roleCount: rolesCache.sizeForParent,
  })((msg) => msg.guild_id),
  childClient.onlyWithCacheResults(),

  RxO.flatMap(([msg, { roleCount }]) =>
    childClient.createMessage(msg.channel_id, {
      message_reference: { message_id: msg.id },
      content: `There are ${roleCount} roles in the cache`,
    }),
  ),
);

// Subscribe
Rx.merge(
  childClient.effects$,
  childRolesCache$,
  roles$,
  roleCount$,
).subscribe();
