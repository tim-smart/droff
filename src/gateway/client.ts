import { GatewayIntentBits } from "discord-api-types/v8";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as Dispatch from "./dispatch";
import * as Shard from "./shard";

export interface Options {
  token: string;
  intents: number;
  shardIDs?: number[];
  shardCount?: number;
}

/** A client is one or more shards */
export function create({
  token,
  intents,
  shardIDs = [0],
  shardCount = 1,
}: Options) {
  const shards = shardIDs.map((id) =>
    Shard.create({
      token,
      intents: intents | GatewayIntentBits.GUILDS,
      shard: [id, shardCount],
    }),
  );

  function close() {
    shards.forEach((s) => s.close());
  }

  function reconnect() {
    shards.forEach((s) => s.reconnect());
  }

  const raw$ = Rx.merge(...shards.map((s) => s.raw$));

  const dispatch$ = Rx.merge(...shards.map((s) => s.dispatch$));
  const dispatchWithShard$ = Rx.merge(
    ...shards.map((s) => s.dispatch$.pipe(RxO.map((p) => [p, s] as const))),
  );
  const dispatchListen = Dispatch.listen$(dispatch$);
  const dispatchWithShardListen = Dispatch.listenWithShard$(dispatchWithShard$);
  const dispatchLatest = Dispatch.latest$(dispatchListen);

  return {
    raw$,
    all$: dispatch$,
    dispatch$: dispatchListen,
    dispatchWithShard$: dispatchWithShardListen,
    latest$: dispatchLatest,
    shards,
    close,
    reconnect,
  };
}

export type Client = ReturnType<typeof create>;
