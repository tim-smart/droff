import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as RL from "../rate-limits/rxjs";
import { Routes } from "../rest/client";
import * as Shard from "./shard";
import { SharderStore } from "./sharder/store";
import * as Store from "./sharder/store";
import * as RxI from "rxjs-iterable";

export type CreateShard = (
  id: [number, number],
  baseURL: string,
  heartbeat: () => void,
) => Shard.Shard;

export interface Options {
  createShard: CreateShard;
  routes: Routes;
  shardConfig?: {
    /**
     * Array of shard IDs you want to start.
     */
    ids?: number[];
    /**
     * The total amount of shards across your entire system.
     *
     * Defaults to a number provider by Discord
     */
    count?: number;
  };
  store?: SharderStore;
  rateLimit: RL.RateLimitOp;
  rateLimitWindow?: number;
  rateLimitLimit?: number;
}

export const spawn = ({
  createShard,
  routes,
  shardConfig,
  store = Store.memoryStore(),
  rateLimit,
  rateLimitWindow = 5000,
  rateLimitLimit = 1,
}: Options) => {
  let cancelled = false;

  async function* generateOpts() {
    const {
      url,
      shards,
      session_start_limit: limit,
    } = await routes.getGatewayBot();

    const count = shardConfig?.count ?? shards;
    const opts = {
      url,
      count,
      concurrency: limit.max_concurrency,
    };

    if (shardConfig?.ids) {
      for (const id of shardConfig.ids) {
        yield { ...opts, id };
      }
      return;
    }

    let sharderCount = 0;
    while (!cancelled) {
      const id = await store.claimId({
        sharderCount,
        totalCount: count,
      })();

      // If there is no id, then check again in 3 minutes
      if (id === undefined) {
        await new Promise((r) => setTimeout(r, 3 * 60 * 1000));
        continue;
      }

      sharderCount++;
      yield { ...opts, id };
    }
  }

  const [opts$, pull] = RxI.from(generateOpts());

  return opts$.pipe(
    RxO.groupBy((opts) => opts.id % opts.concurrency),
    RxO.mergeMap((id$) =>
      id$.pipe(
        rateLimit(
          `gateway.sessions.${id$.key}`,
          rateLimitWindow,
          rateLimitLimit,
        ),
        RxO.map(({ id, count, url }) =>
          createShard([id, count], url, store.heartbeat(id)),
        ),
        RxO.tap(pull),
      ),
    ),
    RxO.finalize(() => {
      cancelled = true;
    }),
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
