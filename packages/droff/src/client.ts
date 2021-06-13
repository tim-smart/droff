import { AxiosInstance } from "axios";
import { Observable } from "rxjs";
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

export interface Options {
  token: string;
  rateLimitStore?: Store.Store;
  debug?: boolean;

  gateway: Omit<GatewayClient.Options, "token" | "rateLimitStore">;
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
  const application$ = Apps.watch$(gateway.dispatch$);
  const guilds$ = Guilds.watch$(gateway.dispatch$);
  const channels$ = Channels.watch$(gateway.dispatch$);
  const roles$ = Roles.watch$(gateway.dispatch$);
  const emojis$ = Emojis.watch$(gateway.dispatch$);
  const members$ = Members.watch$(gateway.dispatch$);

  const withCaches = Resources.withCaches(guilds$);

  function close() {
    gateway.close();
    rest.close();
  }

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

    all$: gateway.all$,
    dispatch$: gateway.dispatch$,
    dispatchWithShard$: gateway.dispatchWithShard$,

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
  application$: Observable<Application>;

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

  /**
   * RxJS rate limit operator, which uses the store.
   */
  rateLimit: RL.RateLimitOp;
}
