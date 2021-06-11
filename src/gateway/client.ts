import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { GatewayIntents } from "../types";
import * as Dispatch from "./dispatch";
import * as Shard from "./shard";
import * as Store from "../rate-limits/store";
import { Routes } from "../rest/client";
import * as RL from "../rate-limits/rxjs";

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

    const createShard = (id: [number, number], baseURL: string) =>
      Shard.create({
        token,
        baseURL,
        intents: intents | GatewayIntents.GUILDS,
        shard: id,
        rateLimit,
      });

    // Start shards with rate limits
    const shards$ = Rx.from(routes.getGatewayBot()).pipe(
      RxO.flatMap(({ url, shards, session_start_limit: limit }) => {
        const ids = shardIDs === "auto" ? [...Array(shards).keys()] : shardIDs;
        const count = shardIDs === "auto" ? ids.length : shardCount;
        return ids.map((id) => ({
          id,
          count,
          url,
          concurrency: limit.max_concurrency,
        }));
      }),

      RxO.groupBy(({ id, concurrency }) => id % concurrency),
      RxO.flatMap((id$) =>
        id$.pipe(
          rateLimit(`gateway.sessions.${id$.key}`, 5500, 1),
          RxO.concatMap(({ id, count, url }) => {
            const shard = createShard([id, count], url);
            return shard.ready$.pipe(
              RxO.first(),
              RxO.map(() => shard),
            );
          }),
        ),
      ),

      RxO.share(),
    );

    const shardsAcc$ = shards$.pipe(
      RxO.scan((acc, shard) => [...acc, shard], [] as Shard.Shard[]),
      RxO.shareReplay(1),
    );

    function close() {
      shardsAcc$
        .pipe(
          RxO.first(),
          RxO.tap((shards) => shards.forEach((s) => s.close())),
        )
        .subscribe();
    }

    function reconnect() {
      shardsAcc$
        .pipe(
          RxO.first(),
          RxO.tap((shards) => shards.forEach((s) => s.reconnect())),
        )
        .subscribe();
    }

    const raw$ = shards$.pipe(RxO.flatMap((s) => s.raw$));
    const dispatch$ = shards$.pipe(RxO.flatMap((s) => s.dispatch$));
    const dispatchWithShard$ = shards$.pipe(
      RxO.flatMap((s) => s.dispatch$.pipe(RxO.map((p) => [p, s] as const))),
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
