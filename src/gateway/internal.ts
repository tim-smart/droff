import {
  GatewayDispatchPayload,
  GatewayHeartbeatAck,
  GatewayHello,
  GatewayIdentify,
  GatewayReadyDispatchData,
  GatewayResume,
} from "discord-api-types/gateway/v8";
import * as F from "fp-ts/function";
import { sequenceT } from "fp-ts/lib/Apply";
import * as O from "fp-ts/Option";
import * as OS from "os";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Options } from "./shard";
import * as Commands from "./commands";
import { Connection } from "./connection";

export const identify$ = (
  conn: Connection,
  latestReady: Rx.BehaviorSubject<O.Option<GatewayReadyDispatchData>>,
  latestSequence: Rx.BehaviorSubject<number | null>,
) => (token: string, { intents, shard }: Pick<Options, "intents" | "shard">) =>
  F.pipe(
    conn.hello$,
    RxO.map(() =>
      F.pipe(
        sequenceT(O.option)(
          latestReady.value,
          O.fromNullable(latestSequence.value),
        ),
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
            }) as GatewayIdentify | GatewayResume,
        ),
      ),
    ),
  );

export const heartbeats$ = (
  conn: Connection,
  sequenceNumber: Rx.BehaviorSubject<number | null>,
) => {
  // Heartbeat
  const interval$ = heartbeatsFromHello(conn.hello$);

  // Heartbeat counters
  const diff$ = heartbeatDiff(interval$, conn.heartbeatAck$, conn.hello$);

  return F.tuple(
    F.pipe(
      interval$,
      RxO.map(() => Commands.heartbeat(sequenceNumber.value)),
    ),
    diff$,
  );
};

const latest = <T, V>(
  dispatch$: Rx.Observable<T>,
  selector: (d: T) => V,
  initialValue: V,
) => {
  const sequenceNumber = new Rx.BehaviorSubject(initialValue);
  const sub = F.pipe(dispatch$, RxO.map(selector)).subscribe(sequenceNumber);
  return F.tuple(sequenceNumber, () => sub.unsubscribe());
};

export const latestSequenceNumber = (
  dispatch$: Rx.Observable<GatewayDispatchPayload>,
) => latest(dispatch$, (p) => p.s, null);

export const heartbeatsFromHello = (hello$: Rx.Observable<GatewayHello>) =>
  F.pipe(
    hello$,
    RxO.switchMap((hello) => {
      const initialDelay = hello.d.heartbeat_interval * Math.random();
      return Rx.merge(
        Rx.timer(initialDelay),
        Rx.timer(initialDelay).pipe(
          RxO.flatMap(() => Rx.interval(hello.d.heartbeat_interval)),
        ),
      );
    }),
    RxO.share(),
  );

export const heartbeatDiff = (
  heartbeats$: Rx.Observable<number>,
  heartbeatAck$: Rx.Observable<GatewayHeartbeatAck>,
  hello$: Rx.Observable<GatewayHello>,
) =>
  Rx.merge(
    heartbeats$.pipe(RxO.map(() => 1)),
    heartbeatAck$.pipe(RxO.map(() => -1)),
    hello$.pipe(RxO.map(() => null)),
  ).pipe(
    RxO.scan((count, diff) => (diff === null ? 0 : count + diff), 0),
    RxO.tap((diff) => {
      if (diff > 1) {
        throw new Error("Heartbeat ACK not received");
      }
    }),
  );
