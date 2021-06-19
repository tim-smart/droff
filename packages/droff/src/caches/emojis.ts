import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import * as Resources from "./resources";

export const watch$ = (fromDispatch: Dispatch) =>
  Resources.watch$(fromDispatch, {
    id: (e) => e.id!,
    guildProp: "emojis",
    update$: fromDispatch("GUILD_EMOJIS_UPDATE").pipe(
      RxO.flatMap(({ emojis, guild_id }) =>
        Rx.from(emojis).pipe(RxO.map((emoji) => [guild_id, emoji] as const)),
      ),
    ),
  });
