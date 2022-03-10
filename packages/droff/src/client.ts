import { AxiosInstance } from "axios";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as Apps from "./caches/applications";
import * as Channels from "./caches/channels";
import * as Emojis from "./caches/emojis";
import * as Guilds from "./caches/guilds";
import * as Invites from "./caches/invites";
import { PartialInvite } from "./caches/invites";
import * as Members from "./caches/members";
import * as DirectMessages from "./caches/direct-messages";
import * as Messages from "./caches/messages";
import * as Roles from "./caches/roles";
import * as StageInstances from "./caches/stage-instances";
import * as CacheStore from "./caches/stores";
import { CacheStoreFactory, NonParentCacheStoreFactory } from "./caches/stores";
import * as GatewayClient from "./gateway/client";
import * as RL from "./rate-limits/rxjs";
import * as Store from "./rate-limits/store";
import * as MemoryStore from "./rate-limits/stores/memory";
import * as RestClient from "./rest/client";
import {
  Application,
  Channel,
  Emoji,
  GatewayPayload,
  Guild,
  GuildMember,
  Message,
  Role,
  StageInstance,
} from "./types";

export { createHandler as createProxyHandler } from "./rest/proxy";

export interface RESTClient extends RestClient.Routes {
  /**
   * Observable of side effects. It is required that you subscribe to this for
   * the client to function.
   */
  effects$: Rx.Observable<never>;
  request: AxiosInstance["request"];
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

    request: client.request.bind(client),
    delete: client.delete.bind(client),
    get: client.get.bind(client),
    patch: client.patch.bind(client),
    post: client.post.bind(client),
    put: client.put.bind(client),

    ...routes,
  };
}

export const createProxyClient = (baseURL: string) =>
  createRestClient({
    token: "",
    baseURL,
    disableRateLimiter: true,
  });

export interface Options {
  /** The discord bot token */
  token: string;

  /**
   * You can supply a custom `RateLimitStore.Store` interface here to change how
   * rate limit counters and bucket information are stored.
   *
   * Defaults to a memory store implementation.
   */
  rateLimitStore?: Store.Store;

  /** Enable debug logging */
  debug?: boolean;

  /** Gateway configuration */
  gateway?: Omit<GatewayClient.Options, "token" | "rateLimitStore">;

  /** REST API configuration */
  rest?: Omit<RestClient.Options, "token" | "rateLimitStore">;
}

export function create({
  token,
  rateLimitStore = MemoryStore.create(),
  debug = false,
  rest: restOptions = {},
  gateway: gatewayOptions = {},
}: Options): Client {
  const rest = createRestClient({
    token,
    rateLimitStore,
    debug,
    ...restOptions,
  });

  const gateway = gatewayOptions.payloads$
    ? GatewayClient.createFromPayloads(
        gatewayOptions.payloads$,
        gatewayOptions.sendOverride,
      )
    : GatewayClient.create(rest)({
        token,
        ...gatewayOptions,
        rateLimits: {
          store: rateLimitStore,
          ...(gatewayOptions.rateLimits || {}),
        },
      });

  // Cached resources
  const applicationCache = CacheStore.fromWatchNonParent(
    Apps.watch$(gateway.fromDispatch),
  );
  const guildsCache = CacheStore.fromWatchNonParent(
    Guilds.watch$(gateway.fromDispatch),
  );
  const channelsCache = CacheStore.fromWatch(
    Channels.watch$(gateway.fromDispatch),
  );
  const rolesCache = CacheStore.fromWatch(Roles.watch$(gateway.fromDispatch));
  const emojisCache = CacheStore.fromWatch(Emojis.watch$(gateway.fromDispatch));
  const membersCache = CacheStore.fromWatch(
    Members.watch$(gateway.fromDispatch),
  );
  const messagesCache = CacheStore.fromWatch(
    Messages.watch$(gateway.fromDispatch),
  );
  const directMessagesCache = CacheStore.fromWatchNonParent(
    DirectMessages.watch$(gateway.fromDispatch),
  );
  const invitesCache = CacheStore.fromWatch(
    Invites.watch$(gateway.fromDispatch, rest),
  );
  const stageInstancesCache = CacheStore.fromWatch(
    StageInstances.watch$(gateway.fromDispatch),
  );

  if (debug) {
    rest.effects$ = Rx.merge(
      rest.effects$,
      gateway.raw$.pipe(
        RxO.tap((p) => console.error("[GATEWAY]", p)),
        RxO.ignoreElements(),
      ),
    );
  }

  return {
    gateway,

    applicationCache,
    directMessagesCache,
    guildsCache,
    channelsCache,
    rolesCache,
    membersCache,
    messagesCache,
    emojisCache,
    invitesCache,
    stageInstancesCache,

    cacheFromWatch: CacheStore.fromWatch,
    nonParentCacheFromWatch: CacheStore.fromWatchNonParent,
    addCacheHelpers: CacheStore.addHelpers,
    addNonParentCacheHelpers: CacheStore.addNonParentHelpers,

    withCaches: CacheStore.withCaches,
    onlyWithCacheResults: CacheStore.onlyWithCacheResults,

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
  applicationCache: NonParentCacheStoreFactory<Application>;
  /** Cache of the latest direct messages for each guild */
  directMessagesCache: NonParentCacheStoreFactory<Message>;
  /** Cache of the latest guilds */
  guildsCache: NonParentCacheStoreFactory<Guild>;
  /** Cache of the latest roles for each guild */
  rolesCache: CacheStoreFactory<Role>;
  /** Cache of the latest channels for each guild */
  channelsCache: CacheStoreFactory<Channel>;
  /** Cache of the latest members for each guild */
  membersCache: CacheStoreFactory<GuildMember>;
  /** Cache of the latest messages for each guild */
  messagesCache: CacheStoreFactory<Message>;
  /** Cache of the latest emojis for each guild */
  emojisCache: CacheStoreFactory<Emoji>;
  /** Cache of the latest invites for each guild */
  invitesCache: CacheStoreFactory<PartialInvite>;
  /** Cache of the latest stageInstances for each guild */
  stageInstancesCache: CacheStoreFactory<StageInstance>;

  /** Create your own cache store from a watcher observable */
  cacheFromWatch: typeof CacheStore.fromWatch;

  /** Create your own cache store with parent ids from a watcher observable */
  nonParentCacheFromWatch: typeof CacheStore.fromWatchNonParent;

  /** Add cache helpers to a cache store */
  addCacheHelpers: typeof CacheStore.addHelpers;

  /** Add cache helpers to a non parent cache store */
  addNonParentCacheHelpers: typeof CacheStore.addNonParentHelpers;

  /**
   * RxJS operator that appends cached data to the stream. E.g.
   *
   * ```typescript
   * client.dispatch$("GUILD_MEMBER_ADD").pipe(
   *   client.withCaches({
   *     roles: rolesCache,
   *   })(({ message }) => message.guild_id),
   * );
   * ```
   */
  withCaches: typeof CacheStore.withCaches;

  /**
   * Use this operator in combination with withCaches.
   * It will filter out any direct messages etc.
   *
   * ```
   * client.dispatch$(Events.GuildMemberAdd).pipe(
   *   client.withCaches({
   *     roles: rolesCache,
   *   })(({ message }) => message.guild_id),
   *   client.onlyWithCacheResults(),
   * );
   * ```
   */
  onlyWithCacheResults: typeof CacheStore.onlyWithCacheResults;

  /**
   * RxJS rate limit operator, which is backed by the store.
   */
  rateLimit: RL.RateLimitOp;
}
