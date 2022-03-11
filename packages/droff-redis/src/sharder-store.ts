import { ClaimIdContext, SharderStore } from "droff/gateway/sharder/store";
import * as Arr from "fp-ts/lib/Array";
import { flow, identity, pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
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
        return client.EXISTS(nodes.map(nodeKey));
      },
      (err) => `nodeCount: ${err}`,
    );

    const firstAvailableId = (totalShards: number) =>
      pipe(
        TE.tryCatch(
          () =>
            client.MGET(Array.from(Array(totalShards).keys()).map(shardKey)),
          (err) => `firstAvailableId MGET: ${err}`,
        ),
        TE.map(Arr.findIndex((nodeId) => !nodeId)),
      );

    const claimId = (shardId: number) =>
      pipe(
        TE.tryCatch(
          () =>
            client
              .multi()
              .SET(shardKey(shardId), -1, { NX: true, PX: ttl })
              .SET(nodeKey(nodeId), "1", { PX: ttl })
              .SADD(membersKey, nodeId)
              .PEXPIRE(membersKey, ttl)
              .exec(),
          (err) => `multi: ${err}`,
        ),
        TE.map(([result]) => result !== null),
        TE.getOrElse((err) => {
          console.error(`[droff-redis] [sharder] [claimId] ${err}`);
          return T.of(false);
        }),
      );

    const claimAvailableId = (
      ctx: ClaimIdContext,
    ): TE.TaskEither<string, number> =>
      pipe(
        firstAvailableId(ctx.totalCount),
        TE.chainOptionK(() => "claimAvailableId: no more available shard ids")(
          identity,
        ),
        TE.chain((id) =>
          pipe(
            claimId(id),
            T.chain((success) =>
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

    const heartbeat = (id: number, latency: number) =>
      TE.tryCatch(
        () =>
          client
            .multi()
            .PEXPIRE(membersKey, ttl)
            .SET(shardKey(id), latency, { PX: ttl })
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

      allClaimed: flow(
        firstAvailableId,
        TE.fold(() => T.of(false), flow(O.isNone, T.of)),
      ),

      heartbeat: (id) => (latency) =>
        pipe(
          heartbeat(id, latency),
          TE.fold(
            (err) => {
              console.error(`[droff-redis] [sharder] [heartbeat] ${err}`);
              return T.of(undefined);
            },
            () => T.of(undefined),
          ),
        )(),
    };
  };
