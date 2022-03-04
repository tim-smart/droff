import { identity } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as RL from "../rate-limits/rxjs";
import * as Store from "../rate-limits/store";
import * as MemoryStore from "../rate-limits/stores/memory";
import { Routes } from "../rest/client";
import {
  GatewayEvent,
  GatewayIntents,
  GatewayOpcode,
  GatewayPayload,
} from "../types";
import { opCode } from "./connection";
import * as Dispatch from "./dispatch";
import * as Shard from "./shard";
import * as Sharder from "./sharder";
import * as SharderStore from "./sharder/store";

export interface Options {
  token: string;

  /** Override gateway handling with custom payload source */
  payloads$?: Rx.Observable<GatewayPayload>;

  rateLimits?: {
    store: Store.Store;

    identifyLimit?: number;
    identifyWindow?: number;

    sendLimit?: number;
    sendWindow?: number;
  };

  /**
   * Bitfield of the gateway intents you want to subscribe to.
   * `Intents.GUILDS` is always enabled.
   */
  intents?: number;

  shardConfig?: Sharder.Options["shardConfig"];

  sharderStore?: Sharder.Options["store"];
}

/** A client is one or more shards */
export const create =
  (routes: Routes) =>
  ({
    token,
    intents = GatewayIntents.GUILDS,
    rateLimits: {
      store: rateLimitStore,
      identifyLimit = 1,
      identifyWindow = 5200,
      ...shardRateLimits
    } = {
      store: MemoryStore.create(),
    },
    shardConfig,
    sharderStore = SharderStore.memoryStore(),
  }: Options) => {
    const rateLimit = RL.rateLimit(rateLimitStore);

    const shards$ = Rx.defer(() =>
      Sharder.spawn({
        createShard: ({ id, baseURL, heartbeat }) =>
          Shard.create({
            token,
            baseURL,
            intents: intents | GatewayIntents.GUILDS,
            shard: id,
            sharderHeartbeat: heartbeat,
            rateLimits: {
              ...shardRateLimits,
              op: rateLimit,
            },
          }),
        routes,
        shardConfig,
        store: sharderStore,
        rateLimit,
        identifyLimit,
        identifyWindow,
      }),
    ).pipe(RxO.shareReplay({ refCount: true }));

    const shardsReady$ = shards$.pipe(
      RxO.switchMap(({ id: [, totalCount], ready$ }) => {
        const delay = identifyWindow / identifyLimit;

        const allClaimed$ = Rx.defer(sharderStore.allClaimed(totalCount)).pipe(
          RxO.repeatWhen((o) => o.pipe(RxO.delay(delay))),
          RxO.first(identity),
          RxO.delay(delay),
        );
        const isReady$ = ready$.pipe(RxO.first(O.isSome));

        return isReady$.pipe(RxO.mergeMap(() => allClaimed$));
      }),
      RxO.map(() => {}),
      RxO.first(),
      RxO.shareReplay({ bufferSize: 1, refCount: true }),
    );

    const raw$ = shards$.pipe(
      RxO.flatMap((s) => s.raw$),
      RxO.share(),
    );
    const dispatch$ = shards$.pipe(
      RxO.flatMap((s) => s.dispatch$),
      RxO.share(),
    );
    const dispatchWithShard$ = shards$.pipe(
      RxO.flatMap((s) => s.dispatch$.pipe(RxO.map((p) => [p, s] as const))),
      RxO.share(),
    );

    const fromDispatch = Dispatch.listen(dispatch$);
    const fromDispatchWithShard = Dispatch.listenWithShard(dispatchWithShard$);
    const latestDispatch = Dispatch.latestDispatch(fromDispatch);

    return {
      raw$,
      dispatch$,
      fromDispatch,
      fromDispatchWithShard,
      latestDispatch,
      shards$,
      shardsReady$,
    };
  };

export type Client = ReturnType<ReturnType<typeof create>>;

export const createFromPayloads = (
  payloads$: Rx.Observable<GatewayPayload>,
): Client => {
  const raw$ = payloads$.pipe(RxO.share());
  const dispatch$ = raw$.pipe(opCode<GatewayEvent>(GatewayOpcode.DISPATCH));
  const dispatchWithShard$ = Rx.EMPTY;
  const shards$ = Rx.EMPTY;
  const shardsReady$ = Rx.of(undefined);

  const fromDispatch = Dispatch.listen(dispatch$);
  const fromDispatchWithShard = Dispatch.listenWithShard(dispatchWithShard$);
  const latestDispatch = Dispatch.latestDispatch(fromDispatch);

  return {
    raw$,
    dispatch$,
    fromDispatch,
    fromDispatchWithShard,
    latestDispatch,
    shards$,
    shardsReady$,
  };
};
