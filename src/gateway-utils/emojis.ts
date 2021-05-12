import { GatewayDispatchEvents } from "discord-api-types";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import * as Resources from "./resources";

export const watch$ = (dispatch$: Dispatch) =>
  Resources.watch$(dispatch$, "emojis", {
    id: (e) => e.id!,
    update$: dispatch$(GatewayDispatchEvents.GuildEmojisUpdate).pipe(
      RxO.flatMap(({ emojis, guild_id }) =>
        Rx.from(emojis).pipe(RxO.map((emoji) => [guild_id, emoji] as const)),
      ),
    ),
  });
