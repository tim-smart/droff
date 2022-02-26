import * as Http from "http";
import {
  createProxyHandler,
  createRestClient,
  createProxyClient,
  createClient,
  Intents,
} from "../src/mod";

// Create the proxy server by:
// * Creating a REST client
// * Creating and passing the request handler to the HTTP server
// * Start the server and rest client effects
const rest = createRestClient({
  token: process.env.DISCORD_BOT_TOKEN!,
});

const server = Http.createServer(createProxyHandler(rest));
server.listen(3000);

rest.effects$.subscribe();

// Create a rest client that uses the proxy
const proxyClient = createProxyClient("http://localhost:3000");
proxyClient.getGatewayBot().then(console.error);

// Or a gateway + rest client that uses the proxy
const client = createClient({
  token: process.env.DISCORD_BOT_TOKEN!,
  rest: {
    // Here is where we tell droff to use the REST proxy
    baseURL: "http://localhost:3000",
    disableRateLimiter: true,
  },
  gateway: {
    intents: Intents.GUILDS,
  },
});
client.getGatewayBot().then(console.error);
