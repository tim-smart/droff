import { createServer } from "http";
import { createProxyHandler, createRestClient } from "../src/client";

const client = createRestClient({
  token: process.env.DISCORD_BOT_TOKEN!,
});

const server = createServer(createProxyHandler(client));
server.listen(3000);

client.effects$.subscribe();
