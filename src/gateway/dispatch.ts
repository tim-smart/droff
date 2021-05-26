import { memoize } from "fp-ts-std/Function";
import * as O from "fp-ts/Option";
import * as Str from "fp-ts/string";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { GatewayEvents, GatewayPayload } from "../types";
import { Shard } from "./shard";

export type Dispatch = <E extends keyof GatewayEvents>(
  event: E,
) => Rx.Observable<GatewayEvents[E]>;

export type DispatchWithShard = <E extends keyof GatewayEvents>(
  event: E,
) => Rx.Observable<readonly [GatewayEvents[E], Shard]>;

export const listen$ = (source$: Rx.Observable<any>): Dispatch =>
  memoize(Str.Eq)((event) =>
    source$.pipe(
      RxO.filter((p) => p.t === event),
      RxO.map((p) => p.d),
      RxO.share(),
    ),
  );

export const listenWithShard$ = (
  source$: Rx.Observable<readonly [GatewayPayload, Shard]>,
): DispatchWithShard =>
  memoize(Str.Eq)((event) =>
    source$.pipe(
      RxO.filter(([p]) => p.t === event),
      RxO.map(([p, shard]) => [p.d, shard] as const),
      RxO.share(),
    ),
  );

export const latest$ =
  (dispatch$: Dispatch) =>
  <E extends keyof GatewayEvents>(
    event: E,
  ): Rx.Observable<O.Option<GatewayEvents[E]>> =>
    Rx.merge(Rx.of(O.none), dispatch$(event).pipe(RxO.map(O.some))).pipe(
      RxO.shareReplay(1),
    );
