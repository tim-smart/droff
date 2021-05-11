import { GatewayDispatchEvents } from "discord-api-types/v8";
import * as Commands from "./gateway-utils/commands";
import * as Guilds from "./gateway-utils/guilds";
import * as GatewayClient from "./gateway/client";
import * as RestClient from "./rest/client";
import * as SlashCommands from "./slash-commands/factory";

export function create(opts: GatewayClient.Options) {
  const gateway = GatewayClient.create(opts);
  const rest = RestClient.create(opts.token);
  const restRoutes = RestClient.routes(rest);
  const guilds$ = Guilds.watch$(gateway.dispatch$);
  const command$ = Commands.command$(
    restRoutes,
    guilds$,
    gateway.dispatch$(GatewayDispatchEvents.MessageCreate),
  );

  function close() {
    gateway.close();
  }

  return {
    gateway,
    guilds$,
    all: gateway.all$,
    dispatch$: gateway.dispatch$,
    close,

    command$,
    useSlashCommands: SlashCommands.factory(
      gateway.dispatch$,
      restRoutes,
      guilds$,
    ),

    delete: rest.delete.bind(rest),
    get: rest.get.bind(rest),
    patch: rest.patch.bind(rest),
    post: rest.post.bind(rest),
    put: rest.put.bind(rest),

    ...restRoutes,
  };
}

export type Client = ReturnType<typeof create>;
