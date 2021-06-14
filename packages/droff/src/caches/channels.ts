import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import { Channel } from "../types";
import * as Resources from "./resources";

export const watch$ = (fromDispatch: Dispatch) =>
  Resources.watch$(fromDispatch, "channels", {
    id: (c: Channel) => c.id,
    create$: fromDispatch("CHANNEL_CREATE").pipe(
      RxO.map((c) => [c.guild_id!, c] as const),
    ),
    update$: fromDispatch("CHANNEL_UPDATE").pipe(
      RxO.map((c) => [c.guild_id!, c] as const),
    ),
    delete$: fromDispatch("CHANNEL_DELETE").pipe(
      RxO.map((c) => [c.guild_id!, c.id] as const),
    ),
  });
