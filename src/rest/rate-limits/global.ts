import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";

export const counter$ =
  (limit: number, window: number) => (requests: Rx.Observable<any>) => {
    return Rx.merge(
      Rx.of(0),
      requests.pipe(RxO.map(() => -1)),
      Rx.interval(window).pipe(RxO.map(() => "reset" as const)),
    ).pipe(
      RxO.scan(
        (remaining, diff) => (diff === "reset" ? limit : remaining + diff),
        limit,
      ),
      RxO.distinctUntilChanged(),
      RxO.shareReplay(1),
    );
  };
