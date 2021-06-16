import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as RL from "../rate-limits/rxjs";
import * as Store from "../rate-limits/store";
import { Routes } from "../rest/client";
import { GatewayIntents } from "../types";
import * as Dispatch from "./dispatch";
import * as Shard from "./shard";
import * as Sharder from "./sharder";

export interface Options {
  token: string;
  rateLimitStore: Store.Store;

  /**
   * Bitfield of the gateway intents you want to subscribe to.
   * `Intents.GUILDS` is always enabled.
   */
  intents: number;

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
    intents,
    rateLimitStore,
    shardIDs = [0],
    shardCount = 1,
  }: Options) => {
    const rateLimit = RL.rateLimit(rateLimitStore);

    const shards = new Set<Shard.Shard>();
    const shards$ = Rx.merge(
      Rx.NEVER,
      Rx.defer(() =>
        Sharder.spawn({
          createShard: (id, baseURL) =>
            Shard.create({
              token,
              baseURL,
              intents: intents | GatewayIntents.GUILDS,
              shard: id,
              rateLimit,
            }),
          rateLimit,
          routes,
          shardIDs,
          shardCount,
        }),
      ),
    ).pipe(
      RxO.tap((s) => shards.add(s)),
      RxO.finalize(() => {
        shards.forEach((s) => s.conn.close());
        shards.clear();
      }),
      RxO.shareReplay(),
    );

    const effects$ = shards$.pipe(RxO.flatMap((s) => s.effects$));

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
      effects$,
      raw$,
      dispatch$,
      fromDispatch,
      fromDispatchWithShard,
      latestDispatch,
      shards$,
    };
  };

export type Client = ReturnType<ReturnType<typeof create>>;
