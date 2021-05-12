import { APIChannel, GatewayDispatchEvents } from "discord-api-types";
import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import * as Resources from "./resources";

export const watch$ = (dispatch$: Dispatch) =>
  Resources.watch$(dispatch$, "channels", {
    id: (c: APIChannel) => c.id,
    create$: dispatch$(GatewayDispatchEvents.ChannelCreate).pipe(
      RxO.map((c) => [c.guild_id!, c] as const),
    ),
    update$: dispatch$(GatewayDispatchEvents.ChannelUpdate).pipe(
      RxO.map((c) => [c.guild_id!, c] as const),
    ),
    delete$: dispatch$(GatewayDispatchEvents.ChannelDelete).pipe(
      RxO.map((c) => [c.guild_id!, c.id] as const),
    ),
  });
