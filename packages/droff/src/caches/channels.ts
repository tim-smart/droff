import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import { Channel } from "../types";
import * as Resources from "./resources";

export const watch$ = (dispatch$: Dispatch) =>
  Resources.watch$(dispatch$, "channels", {
    id: (c: Channel) => c.id,
    create$: dispatch$("CHANNEL_CREATE").pipe(
      RxO.map((c) => [c.guild_id!, c] as const),
    ),
    update$: dispatch$("CHANNEL_UPDATE").pipe(
      RxO.map((c) => [c.guild_id!, c] as const),
    ),
    delete$: dispatch$("CHANNEL_DELETE").pipe(
      RxO.map((c) => [c.guild_id!, c.id] as const),
    ),
  });
