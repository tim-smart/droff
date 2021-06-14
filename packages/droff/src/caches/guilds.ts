import { Map } from "immutable";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import { Guild, Snowflake } from "../types";

export const withOp =
  <K extends string>(key: K) =>
  <T>(data: T) =>
    [key, data] as const;

export type GuildMap = Map<Snowflake, Guild>;

export const watch$ = (dispatch$: Dispatch): Rx.Observable<GuildMap> =>
  Rx.merge(
    Rx.of(["init"] as const),
    dispatch$("GUILD_CREATE").pipe(RxO.map(withOp("create"))),
    dispatch$("GUILD_UPDATE").pipe(RxO.map(withOp("update"))),
    dispatch$("GUILD_DELETE").pipe(RxO.map(withOp("delete"))),
  ).pipe(
    RxO.scan((map, op) => {
      if (op[0] === "init") {
        return map;
      } else if (op[0] === "delete") {
        return map.delete(op[1].id);
      }

      const guild: Guild = { ...op[1] };

      // Un-reference some data that might be garbage collected later.
      // We collect these in the other `watch$` methods.
      guild.roles = [];
      guild.emojis = [];
      delete guild.channels;
      delete guild.members;

      return map.set(guild.id, guild);
    }, Map<Snowflake, Guild>()),

    RxO.shareReplay(1),
  );
