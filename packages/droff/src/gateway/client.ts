import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as RL from "../rate-limits/rxjs";
import * as Store from "../rate-limits/store";
import * as MemoryStore from "../rate-limits/stores/memory";
import { Routes } from "../rest/client";
import {
  GatewayEvent,
  GatewayIntents,
  GatewayOpcode,
  GatewayPayload,
} from "../types";
import { opCode } from "./connection";
import * as Dispatch from "./dispatch";
import * as Shard from "./shard";
import * as Sharder from "./sharder";

export interface Options {
  token: string;

  /** Override gateway handling with custom payload source */
  payloads$?: Rx.Observable<GatewayPayload>;

  rateLimits?: {
    store: Store.Store;

    identifyLimit?: number;
    identifyWindow?: number;

    sendLimit?: number;
    sendWindow?: number;
  };

  /**
   * Bitfield of the gateway intents you want to subscribe to.
   * `Intents.GUILDS` is always enabled.
   */
  intents?: number;

  shardConfig?: Sharder.Options["shardConfig"];

  sharderStore?: Sharder.Options["store"];
}

/** A client is one or more shards */
export const create =
  (routes: Routes) =>
  ({
    token,
    intents = GatewayIntents.GUILDS,
    rateLimits: {
      store: rateLimitStore,
      identifyLimit,
      identifyWindow,
      ...shardRateLimits
    } = {
      store: MemoryStore.create(),
    },
    shardConfig,
    sharderStore,
  }: Options) => {
    const rateLimit = RL.rateLimit(rateLimitStore);

    const shards$ = Rx.defer(() =>
      Sharder.spawn({
        createShard: ({ id, baseURL, heartbeat }) =>
          Shard.create({
            token,
            baseURL,
            intents: intents | GatewayIntents.GUILDS,
            shard: id,
            sharderHeartbeat: heartbeat,
            rateLimits: {
              ...shardRateLimits,
              op: rateLimit,
            },
          }),
        routes,
        shardConfig,
        store: sharderStore,
        rateLimit,
        identifyLimit,
        identifyWindow,
      }),
    ).pipe(RxO.shareReplay({ refCount: true }));

    const raw$ = shards$.pipe(
      RxO.flatMap((s) => s.raw$),
      RxO.share(),
    );
    const dispatch$ = shards$.pipe(
      RxO.flatMap((s) => s.dispatch$),
      RxO.share(),
    );
    const dispatchWithShard$ = shards$.pipe(
      RxO.flatMap((s) => s.dispatch$.pipe(RxO.map((p) => [p, s] as const))),
      RxO.share(),
    );

    const fromDispatch = Dispatch.listen(dispatch$);
    const fromDispatchWithShard = Dispatch.listenWithShard(dispatchWithShard$);
    const latestDispatch = Dispatch.latestDispatch(fromDispatch);

    return {
      raw$,
      dispatch$,
      fromDispatch,
      fromDispatchWithShard,
      latestDispatch,
      shards$,
    };
  };

export type Client = ReturnType<ReturnType<typeof create>>;

export const createFromPayloads = (
  payloads$: Rx.Observable<GatewayPayload>,
): Client => {
  const raw$ = payloads$.pipe(RxO.share());
  const dispatch$ = raw$.pipe(opCode<GatewayEvent>(GatewayOpcode.DISPATCH));
  const dispatchWithShard$ = Rx.EMPTY;
  const shards$ = Rx.EMPTY;

  const fromDispatch = Dispatch.listen(dispatch$);
  const fromDispatchWithShard = Dispatch.listenWithShard(dispatchWithShard$);
  const latestDispatch = Dispatch.latestDispatch(fromDispatch);

  return {
    raw$,
    dispatch$,
    fromDispatch,
    fromDispatchWithShard,
    latestDispatch,
    shards$,
  };
};
