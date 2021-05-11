import * as Shard from "./shard";
import * as Rx from "rxjs";
import * as Dispatch from "./dispatch";
import { GatewayIntentBits } from "discord-api-types/v8";

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

  const dispatch$ = Rx.merge(...shards.map((s) => s.dispatch$));
  const dispatchListen = Dispatch.listen$(dispatch$);
  const dispatchLatest = Dispatch.latest$(dispatchListen);

  return {
    all$: dispatch$,
    dispatch$: dispatchListen,
    latest$: dispatchLatest,
    shards,
    close,
    reconnect,
  };
}

export type Client = ReturnType<typeof create>;
