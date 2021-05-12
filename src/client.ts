import { GatewayDispatchEvents, Snowflake } from "discord-api-types/v8";
import * as Commands from "./gateway-utils/commands";
import * as Guilds from "./gateway-utils/guilds";
import * as Channels from "./gateway-utils/channels";
import * as Roles from "./gateway-utils/roles";
import * as Emojis from "./gateway-utils/emojis";
import * as Members from "./gateway-utils/members";
import * as GatewayClient from "./gateway/client";
import * as RestClient from "./rest/client";
import * as SlashCommands from "./slash-commands/factory";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";

export function create(opts: GatewayClient.Options) {
  const gateway = GatewayClient.create(opts);
  const rest = RestClient.create(opts.token);
  const restRoutes = RestClient.routes(rest);

  // Cached resources
  const guilds$ = Guilds.watch$(gateway.dispatch$);
  const channels$ = Channels.watch$(gateway.dispatch$);
  const roles$ = Roles.watch$(gateway.dispatch$);
  const emojis$ = Emojis.watch$(gateway.dispatch$);
  const members$ = Members.watch$(gateway.dispatch$);

  const withLatest =
    <T>(guildID: (resource: T) => Snowflake | undefined) =>
    (source$: Rx.Observable<T>) =>
      source$.pipe(
        RxO.withLatestFrom(guilds$, channels$, roles$, emojis$, members$),
        RxO.map(([resource, guilds, channels, roles, emojis, members]) => {
          const guild = guilds.get(guildID(resource)!);
          if (!guild) return [resource, undefined] as const;

          return [
            resource,
            {
              guild,
              channels: channels.get(guild.id)!,
              roles: roles.get(guild.id)!,
              emojis: emojis.get(guild.id)!,
              members: members.get(guild.id)!,
            },
          ] as const;
        }),
      );

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
    channels$,
    roles$,
    members$,
    emojis$,
    withLatest: withLatest,

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
