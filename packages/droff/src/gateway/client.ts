import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as RL from "../rate-limits/rxjs";
import * as Store from "../rate-limits/store";
import { createMemoryStore } from "../rate-limits/stores/memory";
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

  rateLimits?: {
    store: Store.Store;

    sessionLimit?: number;
    sessionWindow?: number;

    sendLimit?: number;
    sendWindow?: number;
  };

  /**
   * Bitfield of the gateway intents you want to subscribe to.
   * `Intents.GUILDS` is always enabled.
   */
  intents?: number;

  /**
   * Array of shard IDs you want to start.
   *
   * Can also supply 'auto' to have droff automatically start the correct amount
   * of shards for you.
   *
   * Defaults to `[0]`
   */
  shardIDs?: number[] | "auto";

  /**
   * The total amount of shards across you entire system.
   * Ignored if `shardIDs` is set to 'auto'
   *
   * Defaults to `1`
   */
  shardCount?: number;
}

/** A client is one or more shards */
export const create =
  (routes: Routes) =>
  ({
    token,
    intents = GatewayIntents.GUILDS,
    rateLimits: {
      store: rateLimitStore,
      sessionLimit,
      sessionWindow,
      ...shardRateLimits
    } = { store: createMemoryStore() },
    shardIDs = "auto",
    shardCount = 1,
  }: Options) => {
    const rateLimit = RL.rateLimit(rateLimitStore);

    const shards$ = Sharder.withEffects(() =>
      Sharder.spawn({
        createShard: (id, baseURL) =>
          Shard.create({
            token,
            baseURL,
            intents: intents | GatewayIntents.GUILDS,
            shard: id,
            rateLimits: {
              ...shardRateLimits,
              op: rateLimit,
            },
          }),
        rateLimit,
        rateLimitWindow: sessionWindow,
        rateLimitLimit: sessionLimit,
        routes,
        shardIDs,
        shardCount,
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
