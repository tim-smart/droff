import { ClaimIdContext, SharderStore } from "droff/dist/gateway/sharder/store";
import * as Arr from "fp-ts/lib/Array";
import { flow, pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import { CreateStoreOpts } from "./cache-store";

export const createSharderStore =
  ({ client, prefix = "droff" }: CreateStoreOpts) =>
  (deployment: string, nodeId: string, ttl = 120000): SharderStore => {
    const key = `${prefix}:sharder:${deployment}`;

    const membersKey = `${key}:members`;
    const shardKey = (id: number) => `${key}:shard:${id}`;
    const nodeKey = (id: string) => `${key}:node:${id}`;

    const nodeCount = TE.tryCatch(
      async () => {
        const nodes = await client.SMEMBERS(membersKey);
        if (nodes.length === 0) return 0;

        const results = await client.MGET(nodes.map(nodeKey));
        return results.filter((r) => r !== null).length;
      },
      (err) => `nodeCount: ${err}`,
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
              .SET(shardKey(shardId), nodeId, { NX: true, PX: ttl })
              .SET(nodeKey(nodeId), "1", { PX: ttl })
              .SADD(membersKey, nodeId)
              .PEXPIRE(membersKey, ttl)
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

    const countPerNode = (totalShards: number) =>
      pipe(
        nodeCount,
        TE.map((nodeCount) => Math.ceil(totalShards / nodeCount)),
      );

    const heartbeat = (id: number) =>
      TE.tryCatch(
        () =>
          client
            .multi()
            .PEXPIRE(membersKey, ttl)
            .SET(shardKey(id), nodeId, { PX: ttl })
            .SET(nodeKey(nodeId), "1", { PX: ttl })
            .exec(),
        (err) => `heartbeat: ${err}`,
      );

    return {
      claimId: (ctx) =>
        pipe(
          countPerNode(ctx.totalCount),
          TE.filterOrElse(
            (perNode) => perNode > ctx.sharderCount,
            (perNode) =>
              `Sharder has enough shards. Spawned: ${ctx.sharderCount}. Per node: ${perNode}`,
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
