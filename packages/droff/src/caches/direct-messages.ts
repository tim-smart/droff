import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import { Message } from "../types";
import { CreateOp, DeleteOp, UpdateOp, WatchOp } from "./resources";

export const watch$ = (
  fromDispatch: Dispatch,
): Rx.Observable<WatchOp<Message>> =>
  Rx.merge(
    fromDispatch("MESSAGE_CREATE").pipe(
      RxO.filter((msg) => !msg.guild_id),
      RxO.map(
        (msg): CreateOp<Message> => ({
          event: "create",
          resourceId: msg.id,
          resource: msg,
        }),
      ),
    ),
    fromDispatch("MESSAGE_UPDATE").pipe(
      RxO.filter((msg) => !msg.guild_id),
      RxO.map(
        (msg): UpdateOp<Message> => ({
          event: "update",
          resourceId: msg.id,
          resource: msg,
        }),
      ),
    ),
    fromDispatch("MESSAGE_DELETE").pipe(
      RxO.filter((msg) => !msg.guild_id),
      RxO.map(
        (msg): DeleteOp => ({
          event: "delete",
          resourceId: msg.id,
        }),
      ),
    ),
    fromDispatch("MESSAGE_DELETE_BULK").pipe(
      RxO.filter((p) => !p.guild_id),
      RxO.mergeMap((p) => p.ids),
      RxO.map(
        (id): DeleteOp => ({
          event: "delete",
          resourceId: id,
        }),
      ),
    ),
  );
