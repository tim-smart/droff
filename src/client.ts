import { GatewayDispatchEvents } from "discord-api-types/v8";
import * as Channels from "./gateway-utils/channels";
import * as Commands from "./gateway-utils/commands";
import * as Emojis from "./gateway-utils/emojis";
import * as Guilds from "./gateway-utils/guilds";
import * as Members from "./gateway-utils/members";
import * as Resources from "./gateway-utils/resources";
import * as Roles from "./gateway-utils/roles";
import * as GatewayClient from "./gateway/client";
import * as RestClient from "./rest/client";
import * as SlashCommands from "./slash-commands/factory";

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

  const withLatest = Resources.withLatest(guilds$);

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

    /** Keeps track of the latest guilds */
    guilds$,
    /** Keeps track of the latest channels for each guild */
    channels$,
    /** Keeps track of the latest roles for each guild */
    roles$,
    /** Keeps track of the latest members for each guild */
    members$,
    /** Keeps track of the latest emojis for each guild */
    emojis$,
    /**
     * RxJS operator that appends guild data to the stream. E.g.
     *
     * ```typescript
     * client.dispatch$(Events.GuildMemberAdd).pipe(
     *   client.withLatest({
     *     roles: client.roles$,
     *   })(({ message }) => message.guild_id),
     * );
     * ```
     */
    withLatest,

    /**
     * Use this operator in combination with withLatest.
     * It will filter out any direct messages etc.
     *
     * ```typescript
     * client.dispatch$(Events.GuildMemberAdd).pipe(
     *   client.withLatest({
     *     roles: client.roles$,
     *   })(({ message }) => message.guild_id),
     *   client.onlyWithGuild(),
     * );
     */
    onlyWithGuild: Resources.onlyWithGuild,

    /** Observable of all the dispatch events */
    all: gateway.all$,
    /** Helper function to listen to an individual dispatch event */
    dispatch$: gateway.dispatch$,
    /** Close all the client connections */
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
