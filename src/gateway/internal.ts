import * as F from "fp-ts/function";
import { sequenceT } from "fp-ts/lib/Apply";
import * as O from "fp-ts/Option";
import * as OS from "os";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import {
  GatewayEvent,
  GatewayPayload,
  Heartbeat,
  HelloEvent,
  InvalidSessionEvent,
  ReadyEvent,
} from "../types";
import * as Commands from "./commands";
import { Connection } from "./connection";
import * as Dispatch from "./dispatch";
import { Options } from "./shard";

export const identify$ =
  (
    conn: Connection,
    latestReady: Rx.Observable<O.Option<ReadyEvent>>,
    latestSequence: Rx.Observable<O.Option<number>>,
  ) =>
  (token: string, { intents, shard }: Pick<Options, "intents" | "shard">) =>
    F.pipe(
      conn.hello$,
      RxO.withLatestFrom(latestReady, latestSequence),
      RxO.map(([_, ready, sequence]) =>
        F.pipe(
          sequenceT(O.Apply)(ready, sequence),
          O.fold(
            () =>
              Commands.identify({
                token,
                intents,
                properties: {
                  $os: OS.platform(),
                  $browser: "droff",
                  $device: "droff",
                },
                shard,
              }),

            ([ready, seq]) =>
              Commands.resume({
                token,
                session_id: ready.session_id,
                seq,
              }),
          ),
        ),
      ),
    );

export const heartbeats$ = (
  conn: Connection,
  sequenceNumber: Rx.Observable<O.Option<number>>,
) => {
  // Heartbeat
  const interval$ = heartbeatsFromHello(conn.hello$);

  // Heartbeat counters
  const diff$ = heartbeatDiff(interval$, conn.heartbeatAck$, conn.hello$);

  return F.tuple(
    F.pipe(
      interval$,
      RxO.withLatestFrom(sequenceNumber),
      RxO.map(([_, sequence]) => Commands.heartbeat(O.toNullable(sequence))),
    ),
    diff$,
  );
};

const latest = <T, V>(
  dispatch$: Rx.Observable<T>,
  selector: (d: T) => V,
  initialValue: V,
) =>
  Rx.merge(Rx.of(initialValue), dispatch$.pipe(RxO.map(selector))).pipe(
    RxO.shareReplay(1),
  );

export const latestSequenceNumber = (
  dispatch$: Rx.Observable<GatewayPayload<GatewayEvent>>,
) => latest(dispatch$, (p) => O.fromNullable(p.s), O.none);

export const latestReady = (
  dispatch$: Dispatch.Dispatch,
  invalidSession$: Rx.Observable<GatewayPayload<InvalidSessionEvent>>,
): Rx.Observable<O.Option<ReadyEvent>> =>
  Rx.merge(
    Dispatch.latest$(dispatch$)("READY"),
    invalidSession$.pipe(
      RxO.flatMap((data) => (data.d ? Rx.EMPTY : Rx.of(O.none))),
    ),
  ).pipe(RxO.shareReplay(1));

export const heartbeatsFromHello = (
  hello$: Rx.Observable<GatewayPayload<HelloEvent>>,
) =>
  F.pipe(
    hello$,
    RxO.switchMap((hello) => {
      const initialDelay = hello.d!.heartbeat_interval * Math.random();
      return Rx.merge(
        Rx.timer(initialDelay),
        Rx.timer(initialDelay).pipe(
          RxO.flatMap(() => Rx.interval(hello.d!.heartbeat_interval)),
        ),
      );
    }),
    RxO.share(),
  );

export const heartbeatDiff = (
  heartbeats$: Rx.Observable<number>,
  heartbeatAck$: Rx.Observable<GatewayPayload>,
  hello$: Rx.Observable<GatewayPayload<HelloEvent>>,
) =>
  Rx.merge(
    heartbeats$.pipe(RxO.map(() => O.some(1))),
    heartbeatAck$.pipe(RxO.map(() => O.some(-1))),
    hello$.pipe(RxO.map(() => O.none as O.Option<number>)),
  ).pipe(
    RxO.scan(
      (count, diff) =>
        F.pipe(
          diff,
          O.fold(
            () => 0,
            (diff) => count + diff,
          ),
        ),
      0,
    ),
  );
