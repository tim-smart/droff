import * as Guilds from "./gateway-utils/guilds";
import * as GatewayClient from "./gateway/client";

export function create(opts: GatewayClient.Options) {
  const gateway = GatewayClient.create(opts);
  const guilds$ = Guilds.watch$(gateway.dispatch$);

  function close() {
    gateway.close();
  }

  return {
    gateway,
    guilds$,
    dispatch$: gateway.dispatch$,
    close,
  };
}

export type Client = ReturnType<typeof create>;
