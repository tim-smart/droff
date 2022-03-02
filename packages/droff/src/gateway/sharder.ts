import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as RL from "../rate-limits/rxjs";
import { Routes } from "../rest/client";
import * as Shard from "./shard";

export type CreateShard = (
  id: [number, number],
  baseURL?: string,
) => Shard.Shard;

export interface Options {
  createShard: CreateShard;
  routes: Routes;
  shardIDs: number[] | "auto";
  shardCount: number;
  rateLimit: RL.RateLimitOp;
  rateLimitWindow?: number;
  rateLimitLimit?: number;
}

export const spawn = ({
  createShard,
  routes,
  shardIDs,
  shardCount,
  rateLimit,
  rateLimitWindow = 5000,
  rateLimitLimit = 1,
}: Options) => {
  // If we only need one shard, then short circuit.
  if (shardCount === 1 && shardIDs !== "auto") {
    return Rx.of(createShard([0, 1]));
  }

  // Start shards with rate limits
  return Rx.from(routes.getGatewayBot()).pipe(
    RxO.flatMap(({ url, shards, session_start_limit: limit }) => {
      const ids = shardIDs === "auto" ? [...Array(shards).keys()] : shardIDs;
      const count = shardIDs === "auto" ? shards : shardCount;

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
        rateLimit(
          `gateway.sessions.${id$.key}`,
          rateLimitWindow,
          rateLimitLimit,
        ),
        RxO.map(({ id, count, url }) => createShard([id, count], url)),
      ),
    ),
  );
};

export const withEffects = (sharder: () => Rx.Observable<Shard.Shard>) =>
  new Rx.Observable<Shard.Shard>((s) => {
    const sub = sharder()
      .pipe(
        RxO.tap((shard) => {
          s.next(shard);
        }),
        RxO.flatMap((shard) => shard.effects$),
      )
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
  });
