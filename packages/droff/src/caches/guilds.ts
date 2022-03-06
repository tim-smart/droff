import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import { Guild } from "../types";
import { WatchOp } from "./resources";

const withOp =
  <K extends string, T>(key: K) =>
  (data: T) =>
    [key, data] as const;

export const watch$ = (fromDispatch: Dispatch) =>
  Rx.merge(
    fromDispatch("GUILD_CREATE").pipe(RxO.map(withOp("create"))),
    fromDispatch("GUILD_UPDATE").pipe(RxO.map(withOp("update"))),
    fromDispatch("GUILD_DELETE").pipe(RxO.map(withOp("delete"))),
  ).pipe(
    RxO.map((op): WatchOp<Guild> => {
      switch (op[0]) {
        case "create":
        case "update":
          // Un-reference some data that might be garbage collected later.
          // We collect these in the other `watch$` methods.
          const guild: Guild = {
            ...op[1],
            roles: [],
            emojis: [],
            channels: [],
            members: [],
          };

          return {
            event: op[0],
            resourceId: guild.id,
            resource: guild,
          };

        case "delete":
          return {
            event: "delete",
            resourceId: op[1].id,
          };
      }
    }),
  );
