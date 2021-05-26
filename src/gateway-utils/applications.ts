import * as RxO from "rxjs/operators";
import * as GatewayClient from "../gateway/client";

export const watch$ = (dispatch$: GatewayClient.Client["dispatch$"]) =>
  dispatch$("READY").pipe(
    RxO.map((ready) => ready.application),
    RxO.shareReplay(1),
  );
