import { ClaimIdContext, SharderStore } from "droff/dist/gateway/sharder/store";
import * as Arr from "fp-ts/lib/Array";
import { flow, pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import { CreateStoreOpts } from "./cache-store";

export const createSharderStore =
  ({ client, prefix = "droff" }: CreateStoreOpts) =>
  (deployment: string, nodeId: string, ttl = 90000): SharderStore => {
    const key = `${prefix}:sharder:${deployment}`;

    const shardersKey = `${key}:members`;
    const shardKey = (id: number) => `${key}:${id}`;

    const sharderCount = TE.tryCatch(
      () => client.SCARD(shardersKey),
      (err) => `sharderCount: ${err}`,
    );

    const firstAvailableId = (totalShards: number) =>
      pipe(
        TE.tryCatch(
          () => client.MGET([...Array(totalShards).keys()].map(shardKey)),
          (err) => `firstAvailableId MGET: ${err}`,
        ),
        TE.chainOptionK(() => "firstAvailableId: No more available shard ids")(
          Arr.findIndex((taken) => !taken),
        ),
      );

    const claimId = (shardId: number) =>
      pipe(
        TE.tryCatch(
          () =>
            client
              .multi()
              .SET(shardKey(shardId), nodeId, {
                NX: true,
                PX: ttl,
              })
              .SADD(shardersKey, nodeId)
              .PEXPIRE(shardersKey, ttl)
              .exec(),
          (err) => `claimId multi: ${err}`,
        ),
        TE.map(([result]) => result !== null),
      );

    const claimAvailableId = (
      ctx: ClaimIdContext,
    ): TE.TaskEither<string, number> =>
      pipe(
        firstAvailableId(ctx.totalCount),
        TE.chain((id) =>
          pipe(
            claimId(id),
            TE.chain((success) =>
              success ? TE.right(id) : claimAvailableId(ctx),
            ),
          ),
        ),
      );

    const countPerSharder = (totalShards: number) =>
      pipe(
        sharderCount,
        TE.map((sharderCount) => Math.ceil(totalShards / sharderCount)),
      );

    const heartbeat = (id: number) =>
      TE.tryCatch(
        () =>
          client
            .multi()
            .PEXPIRE(shardersKey, ttl)
            .SET(shardKey(id), nodeId, { PX: ttl })
            .exec(),
        (err) => `heartbeat: ${err}`,
      );

    return {
      claimId: (ctx) =>
        pipe(
          countPerSharder(ctx.totalCount),
          TE.filterOrElse(
            (perSharder) => perSharder > ctx.sharderCount,
            (perSharder) =>
              `Sharder has enough shards. Spawned: ${ctx.sharderCount}. Per sharder: ${perSharder}`,
          ),
          TE.chain(() => claimAvailableId(ctx)),

          TE.getOrElseW((err) => {
            console.error(`[droff-redis] [sharder] [claimId] ${err}`);
            return T.of(undefined);
          }),
        ),

      heartbeat: flow(
        heartbeat,
        TE.fold(
          (err) => {
            console.error(`[droff-redis] [sharder] [heartbeat] ${err}`);
            return T.of(undefined);
          },
          () => T.of(undefined),
        ),
      ),
    };
  };
