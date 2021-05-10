import { GatewayDispatchEvents as E } from "discord-api-types/gateway/v8";
import * as RxO from "rxjs/operators";
import * as GatewayClient from "../gateway/client";

export const watch$ = (dispatch$: GatewayClient.Client["dispatch$"]) =>
  dispatch$(E.Ready).pipe(
    RxO.map((ready) => ready.application),
    RxO.shareReplay(1),
  );
