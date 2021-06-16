import { AxiosInstance } from "axios";
import * as Rx from "rxjs";
import * as Apps from "./caches/applications";
import * as Channels from "./caches/channels";
import * as Emojis from "./caches/emojis";
import * as Guilds from "./caches/guilds";
import * as Members from "./caches/members";
import * as Resources from "./caches/resources";
import * as Roles from "./caches/roles";
import * as GatewayClient from "./gateway/client";
import * as RL from "./rate-limits/rxjs";
import * as Store from "./rate-limits/store";
import * as RestClient from "./rest/client";
import { Application, Channel, Emoji, Guild, GuildMember, Role } from "./types";

export interface RESTClient extends RestClient.Routes {
  /**
   * Observable of side effects. It is required that you subscribe to this for
   * the client to function.
   */
  effects$: Rx.Observable<void>;
  get: AxiosInstance["get"];
  post: AxiosInstance["post"];
  patch: AxiosInstance["patch"];
  put: AxiosInstance["put"];
  delete: AxiosInstance["delete"];
}

export function createRestClient(opts: RestClient.Options): RESTClient {
  const [client, rateLimiting$] = RestClient.create(opts);
  const routes = RestClient.routes(client);

  return {
    effects$: rateLimiting$,

    delete: client.delete.bind(client),
    get: client.get.bind(client),
    patch: client.patch.bind(client),
    post: client.post.bind(client),
    put: client.put.bind(client),

    ...routes,
  };
}

export interface Options {
  /** The discord bot token */
  token: string;

  /**
   * You can supply a custom `RateLimitStore.Store` interface here to change how
   * rate limit counters and bucket information are stored.
   *
   * Defaults to `RateLimitStore.createMemoryStore()`.
   */
  rateLimitStore?: Store.Store;

  /** Enable debug logging */
  debug?: boolean;

  /** Gateway configuration */
  gateway: Omit<GatewayClient.Options, "token" | "rateLimitStore">;

  /** REST API configuration */
  rest?: Omit<RestClient.Options, "token" | "rateLimitStore">;
}

export function create({
  token,
  rateLimitStore = Store.createMemoryStore(),
  debug = false,
  rest: restOptions = {},
  gateway: gatewayOptions,
}: Options): Client {
  const rest = createRestClient({
    token,
    rateLimitStore,
    debug,
    ...restOptions,
  });
  const gateway = GatewayClient.create(rest)({
    token,
    rateLimitStore,
    ...gatewayOptions,
  });

  // Cached resources
  const application$ = Apps.watch$(gateway.fromDispatch);
  const guilds$ = Guilds.watch$(gateway.fromDispatch);
  const channels$ = Channels.watch$(gateway.fromDispatch);
  const roles$ = Roles.watch$(gateway.fromDispatch);
  const emojis$ = Emojis.watch$(gateway.fromDispatch);
  const members$ = Members.watch$(gateway.fromDispatch);

  const withCaches = Resources.withCaches(guilds$);

  if (debug) {
    gateway.raw$.subscribe((p) => console.error("[GATEWAY]", p));
  }

  return {
    gateway,

    application$,
    guilds$,
    channels$,
    roles$,
    members$,
    emojis$,
    withCaches,

    onlyWithGuild: Resources.onlyWithGuild,

    dispatch$: gateway.dispatch$,
    fromDispatch: gateway.fromDispatch,
    fromDispatchWithShard: gateway.fromDispatchWithShard,

    rateLimit: RL.rateLimit(rateLimitStore),

    ...rest,
  };
}

export type Client = RESTClient & ClientExtras;

export interface ClientExtras {
  gateway: GatewayClient.Client;
  /** Observable of all the dispatch events */
  dispatch$: GatewayClient.Client["dispatch$"];
  /** Helper function to listen to an individual dispatch event */
  fromDispatch: GatewayClient.Client["fromDispatch"];
  /**
   * Helper function to listen to an individual dispatch event, along with
   * the shard
   */
  fromDispatchWithShard: GatewayClient.Client["fromDispatchWithShard"];

  /** Cache of the latest application */
  application$: Rx.Observable<Application>;
  /** Cache of the latest guilds */
  guilds$: Rx.Observable<Resources.SnowflakeMap<Guild>>;
  /** Cache of the latest roles for each guild */
  roles$: Rx.Observable<Resources.GuildSnowflakeMap<Role>>;
  /** Cache of the latest channels for each guild */
  channels$: Rx.Observable<Resources.GuildSnowflakeMap<Channel>>;
  /** Cache of the latest members for each guild */
  members$: Rx.Observable<Resources.GuildSnowflakeMap<GuildMember>>;
  /** Cache of the latest emojis for each guild */
  emojis$: Rx.Observable<Resources.GuildSnowflakeMap<Emoji>>;

  /**
   * RxJS operator that appends cached data to the stream. E.g.
   *
   * ```typescript
   * client.dispatch$("GUILD_MEMBER_ADD").pipe(
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

  /**
   * RxJS rate limit operator, which is backed by the store.
   */
  rateLimit: RL.RateLimitOp;
}
