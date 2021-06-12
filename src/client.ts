import { AxiosInstance } from "axios";
import { Observable } from "rxjs";
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
import { Channel, Emoji, Guild, GuildMember, Role } from "./types";
import * as Store from "./rate-limits/store";
import * as RL from "./rate-limits/rxjs";

export interface RESTClient extends RestClient.Routes {
  close: () => void;
  get: AxiosInstance["get"];
  post: AxiosInstance["post"];
  patch: AxiosInstance["patch"];
  put: AxiosInstance["put"];
  delete: AxiosInstance["delete"];
}

export function createRestClient(opts: RestClient.Options): RESTClient {
  const [client, close] = RestClient.create(opts);
  const routes = RestClient.routes(client);

  return {
    close,

    delete: client.delete.bind(client),
    get: client.get.bind(client),
    patch: client.patch.bind(client),
    post: client.post.bind(client),
    put: client.put.bind(client),

    ...routes,
  };
}

export function create({
  rateLimitStore = Store.createMemoryStore(),
  ...opts
}: GatewayClient.Options & RestClient.Options): Client {
  const rest = createRestClient({
    rateLimitStore,
    ...opts,
  });
  const gateway = GatewayClient.create(rest)({
    rateLimitStore,
    ...opts,
  });

  // Cached resources
  const guilds$ = Guilds.watch$(gateway.dispatch$);
  const channels$ = Channels.watch$(gateway.dispatch$);
  const roles$ = Roles.watch$(gateway.dispatch$);
  const emojis$ = Emojis.watch$(gateway.dispatch$);
  const members$ = Members.watch$(gateway.dispatch$);

  const withCaches = Resources.withCaches(guilds$);

  const command$ = Commands.command$(
    rest,
    guilds$,
    gateway.dispatch$("MESSAGE_CREATE"),
  );

  function close() {
    gateway.close();
    rest.close();
  }

  if (opts.debug) {
    gateway.raw$.subscribe((p) => console.error("[GATEWAY]", p));
  }

  return {
    gateway,

    guilds$,
    channels$,
    roles$,
    members$,
    emojis$,
    withCaches,

    onlyWithGuild: Resources.onlyWithGuild,

    all$: gateway.all$,
    dispatch$: gateway.dispatch$,
    dispatchWithShard$: gateway.dispatchWithShard$,

    command$,
    useSlashCommands: SlashCommands.factory(gateway.dispatch$, rest, guilds$),

    rateLimit: RL.rateLimit(rateLimitStore),

    ...rest,

    close,
  };
}

export interface Client extends RESTClient {
  gateway: GatewayClient.Client;
  /** Observable of all the dispatch events */
  all$: GatewayClient.Client["all$"];
  /** Helper function to listen to an individual dispatch event */
  dispatch$: GatewayClient.Client["dispatch$"];
  /**
   * Helper function to listen to an individual dispatch event, along with
   * the shard
   */
  dispatchWithShard$: GatewayClient.Client["dispatchWithShard$"];

  /** Cache of the latest guilds */
  guilds$: Observable<Resources.SnowflakeMap<Guild>>;
  /** Cache of the latest roles for each guild */
  roles$: Observable<Resources.GuildSnowflakeMap<Role>>;
  /** Cache of the latest channels for each guild */
  channels$: Observable<Resources.GuildSnowflakeMap<Channel>>;
  /** Cache of the latest members for each guild */
  members$: Observable<Resources.GuildSnowflakeMap<GuildMember>>;
  /** Cache of the latest emojis for each guild */
  emojis$: Observable<Resources.GuildSnowflakeMap<Emoji>>;

  /**
   * RxJS operator that appends cached data to the stream. E.g.
   *
   * ```typescript
   * client.dispatch$(Events.GuildMemberAdd).pipe(
   *   client.withCaches({
   *     roles: client.roles$,
   *   })(({ message }) => message.guild_id),
   * );
   * ```
   */
  withCaches: ReturnType<typeof Resources.withCaches>;
  /**
   * Use this operator in combination with withCaches.
   * It will filter out any direct messages etc.
   *
   * ```typescript
   * client.dispatch$(Events.GuildMemberAdd).pipe(
   *   client.withCaches({
   *     roles: client.roles$,
   *   })(({ message }) => message.guild_id),
   *   client.onlyWithGuild(),
   * );
   */
  onlyWithGuild: typeof Resources.onlyWithGuild;

  command$: ReturnType<typeof Commands.command$>;
  useSlashCommands: () => SlashCommands.SlashCommandsHelper;

  /**
   * RxJS rate limit operator, which uses the store.
   */
  rateLimit: RL.RateLimitOp;
}
