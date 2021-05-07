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
  let diff = heartbeatDiff(interval$, conn.heartbeatAck$);

  // Reset counters on hello
  conn.hello$.pipe(RxO.skip(1)).subscribe(() => {
    diff.complete();
    diff = heartbeatDiff(interval$, conn.heartbeatAck$);
  });

  // Make sure ACK is received before sending another heartbeat
  return F.pipe(
    interval$,
    RxO.tap(() => {
      if (diff.value > 0) {
        throw new Error("Missing heartbeat ACK");
      }
    }),
    RxO.map(() => Commands.heartbeat(sequenceNumber.value)),
  );
};

const latest = <T, V>(
  dispatch$: Rx.Observable<T>,
  selector: (d: T) => V,
  initialValue: V,
) => {
  const sequenceNumber = new Rx.BehaviorSubject(initialValue);
  F.pipe(dispatch$, RxO.map(selector)).subscribe(sequenceNumber);
  return sequenceNumber;
};

export const latestSequenceNumber = (
  dispatch$: Rx.Observable<GatewayDispatchPayload>,
) => latest(dispatch$, (p) => p.s, null);

export const heartbeatsFromHello = (hello$: Rx.Observable<GatewayHello>) =>
  F.pipe(
    hello$,
    RxO.switchMap((hello) =>
      F.pipe(
        Rx.timer(hello.d.heartbeat_interval * Math.random()),
        RxO.expand(() => Rx.timer(hello.d.heartbeat_interval)),
      ),
    ),
    RxO.share(),
  );

export const heartbeatDiff = (
  heartbeats$: Rx.Observable<0>,
  heartbeatAck$: Rx.Observable<GatewayHeartbeatAck>,
) => {
  const subject = new Rx.BehaviorSubject(0);

  Rx.merge(
    heartbeats$.pipe(RxO.map(() => 1)),
    heartbeatAck$.pipe(RxO.map(() => -1)),
  )
    .pipe(RxO.scan((count, diff) => count + diff, 0))
    .subscribe(subject);

  return subject;
};
