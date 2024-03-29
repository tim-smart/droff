import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { ReceiveEvents, GatewayPayload } from "../types";
import { memoize } from "../utils/memoize";
import { Shard } from "./shard";

export type Dispatch = <E extends keyof ReceiveEvents>(
  event: E,
) => Rx.Observable<ReceiveEvents[E]>;

export type DispatchWithShard = <E extends keyof ReceiveEvents>(
  event: E,
) => Rx.Observable<readonly [ReceiveEvents[E], Shard]>;

export const listen = (source$: Rx.Observable<any>): Dispatch =>
  memoize((event) =>
    source$.pipe(
      RxO.filter((p) => p.t === event),
      RxO.map((p) => p.d),
      RxO.share(),
    ),
  );

export const listenWithShard = (
  source$: Rx.Observable<readonly [GatewayPayload, Shard]>,
): DispatchWithShard =>
  memoize((event) =>
    source$.pipe(
      RxO.filter(([p]) => p.t === event),
      RxO.map(([p, shard]) => [p.d, shard] as const),
      RxO.share(),
    ),
  );

export const latest = (fromDispatch: Dispatch): Dispatch =>
  memoize((event) =>
    fromDispatch(event as keyof ReceiveEvents).pipe(
      RxO.shareReplay({ bufferSize: 1, refCount: true }) as any,
    ),
  );
