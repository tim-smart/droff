import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";

export const watch$ = (fromDispatch: Dispatch) =>
  fromDispatch("READY").pipe(
    RxO.map((ready) => ready.application),
    RxO.shareReplay(1),
  );
