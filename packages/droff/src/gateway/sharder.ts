import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as RL from "../rate-limits/rxjs";
import { Routes } from "../rest/client";
import * as Shard from "./shard";
import { SharderStore } from "./sharder/store";
import * as Store from "./sharder/store";
import * as RxI from "rxjs-iterable";

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
  store?: SharderStore;
  rateLimit: RL.RateLimitOp;
  identifyLimit?: number;
  identifyWindow?: number;
}

export const spawn = ({
  createShard,
  routes,
  shardConfig,
  store = Store.memoryStore(),
  rateLimit,
  identifyLimit = 1,
  identifyWindow = 5000,
}: Options) => {
  function generateOpts() {
    let cancelled = false;
    let timeout: NodeJS.Timeout;
    const cancel = () => {
      cancelled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
    };

    async function* iterator() {
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

  const [optsIterator, cancel] = generateOpts();
  const [opts$, pull] = RxI.from(optsIterator);

  return opts$.pipe(
    RxO.map((opts, index) => {
      if (index === 0 && opts.concurrency > 1) {
        for (let i = 1; i < opts.concurrency; i++) {
          pull();
        }
      }
      return opts;
    }),

    RxO.groupBy(({ id, concurrency }) => id % concurrency),
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
        RxO.tap(pull),
        RxO.mergeMap((s) => Rx.merge(Rx.of(s), s.effects$)),
      ),
    ),

    RxO.finalize(cancel),
  );
};
