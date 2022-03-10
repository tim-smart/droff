import * as Rx from "rxjs";
import * as RxI from "rxjs-iterable";
import * as RxO from "rxjs/operators";
import * as RL from "../rate-limits/rxjs";
import { Routes } from "../rest/client";
import { GetGatewayBotResponse } from "../types";
import * as Shard from "./shard";
import { SharderStore } from "./sharder/store";

export type CreateShard = (opts: {
  id: [number, number];
  baseURL: string;
  heartbeat: () => void;
}) => Shard.Shard;

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
  store: SharderStore;
  rateLimit: RL.RateLimitOp;
  identifyLimit: number;
  identifyWindow: number;
}

export const spawn = ({
  createShard,
  routes,
  shardConfig,
  store,
  rateLimit,
  identifyLimit,
  identifyWindow,
}: Options) =>
  Rx.defer(() => routes.getGatewayBot()).pipe(
    RxO.catchError(() =>
      Rx.of<GetGatewayBotResponse>({
        url: "wss://gateway.discord.gg/",
        shards: 1,
        session_start_limit: {
          total: 0,
          remaining: 0,
          reset_after: 0,
          max_concurrency: 1,
        },
      }),
    ),

    RxO.mergeMap(({ url, shards, session_start_limit: limit }) => {
      const totalCount = shardConfig?.count ?? shards;
      const concurrency = limit.max_concurrency;

      const [iterator, cancel] = generateShardConfigs({
        url,
        totalCount,
        store,
        shardConfig,
      });

      const [configs$, pull] = RxI.from(iterator, {
        initialCount: concurrency,
      });

      return configs$.pipe(
        RxO.groupBy(({ id }) => id % concurrency),
        RxO.mergeMap((group$) =>
          group$.pipe(
            rateLimit(
              `gateway.sharder.${group$.key}`,
              identifyWindow,
              identifyLimit,
            ),
            RxO.map(({ id, count, url }) =>
              createShard({
                id: [id, count],
                baseURL: url,
                heartbeat: store.heartbeat(id),
              }),
            ),
            RxO.mergeMap((s) => Rx.merge(Rx.of(s), s.effects$)),
            RxO.tap(pull),
          ),
        ),

        RxO.finalize(cancel),
      );
    }),
  );

interface GeneratorOptsOpts {
  url: string;
  totalCount: number;
  shardConfig: Options["shardConfig"];
  store: SharderStore;
}

function generateShardConfigs({
  url,
  totalCount: count,
  shardConfig,
  store,
}: GeneratorOptsOpts) {
  let cancelled = false;
  let timeout: NodeJS.Timeout;
  const cancel = () => {
    cancelled = true;
    if (timeout) {
      clearTimeout(timeout);
    }
  };

  async function* iterator() {
    const opts = { url, count };

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
        await new Promise((r) => {
          timeout = setTimeout(r, 3 * 60 * 1000);
        });
        continue;
      }

      sharderCount++;
      yield { ...opts, id };
    }
  }

  return [iterator(), cancel!] as const;
}
