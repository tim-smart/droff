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
  intents: number;
  shardIDs?: number[] | "auto";
  shardCount?: number;
  rateLimitStore?: Store.Store;
}

/** A client is one or more shards */
export const create =
  (routes: Routes) =>
  ({
    token,
    intents,
    rateLimitStore = Store.createMemoryStore(),
    shardIDs = [0],
    shardCount = 1,
  }: Options) => {
    const rateLimit = RL.rateLimit(rateLimitStore);
    const shards$ = Sharder.spawn({
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
    });

    const shardsAcc$ = shards$.pipe(
      RxO.scan((acc, shard) => [...acc, shard], [] as Shard.Shard[]),
      RxO.shareReplay(1),
    );
    const shardsSub = shardsAcc$.subscribe();

    function close() {
      shardsAcc$
        .pipe(
          RxO.first(),
          RxO.tap((shards) => shards.forEach((s) => s.close())),
        )
        .subscribe();
      shardsSub.unsubscribe();
    }

    function reconnect() {
      shardsAcc$
        .pipe(
          RxO.first(),
          RxO.tap((shards) => shards.forEach((s) => s.reconnect())),
        )
        .subscribe();
    }

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

    const dispatchListen = Dispatch.listen$(dispatch$);
    const dispatchWithShardListen =
      Dispatch.listenWithShard$(dispatchWithShard$);
    const dispatchLatest = Dispatch.latest$(dispatchListen);

    return {
      raw$,
      all$: dispatch$,
      dispatch$: dispatchListen,
      dispatchWithShard$: dispatchWithShardListen,
      latest$: dispatchLatest,
      shards$: shards$,
      shardsArray$: shardsAcc$,
      close,
      reconnect,
    };
  };

export type Client = ReturnType<ReturnType<typeof create>>;
