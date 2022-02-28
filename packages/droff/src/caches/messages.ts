import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import { Message } from "../types";
import * as Resources from "./resources";

export const watch$ = (fromDispatch: Dispatch) =>
  Resources.watch$(fromDispatch, {
    id: (message: Message) => message.id,
    create$: Rx.merge(
      fromDispatch("MESSAGE_CREATE").pipe(
        RxO.filter((message) => !!message.guild_id),
        RxO.map((message) => [message.guild_id!, message] as const),
      ),
    ),
    update$: fromDispatch("MESSAGE_UPDATE").pipe(
      RxO.filter((message) => !!message.guild_id),
      RxO.map((message) => [message.guild_id!, message] as const),
    ),
    delete$: Rx.merge(
      fromDispatch("MESSAGE_DELETE").pipe(
        RxO.filter((message) => !!message.guild_id),
        RxO.map((message) => [message.guild_id!, message.id] as const),
      ),
      fromDispatch("MESSAGE_DELETE_BULK").pipe(
        RxO.filter(({ guild_id }) => !!guild_id),
        RxO.flatMap(({ guild_id, ids }) =>
          ids.map((id) => [guild_id!, id] as const),
        ),
      ),
    ),
  });
