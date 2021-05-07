import * as Guilds from "./gateway-utils/guilds";
import * as GatewayClient from "./gateway/client";
import * as RestClient from "./rest/client";

export function create(opts: GatewayClient.Options) {
  const gateway = GatewayClient.create(opts);
  const rest = RestClient.create(opts.token);
  const guilds$ = Guilds.watch$(gateway.dispatch$);

  function close() {
    gateway.close();
  }

  return {
    gateway,
    guilds$,
    all: gateway.all$,
    dispatch$: gateway.dispatch$,
    close,

    delete: rest.delete.bind(rest),
    get: rest.get.bind(rest),
    patch: rest.patch.bind(rest),
    post: rest.post.bind(rest),
    put: rest.put.bind(rest),

    ...RestClient.routes(rest),
  };
}

export type Client = ReturnType<typeof create>;
