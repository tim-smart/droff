import { identity } from "fp-ts/lib/function";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import { Routes } from "../rest/client";
import { Invite, InviteMetadatum, Snowflake } from "../types";
import * as Resources from "./resources";

export type PartialInvite = Omit<Invite & InviteMetadatum, "channel"> & {
  channel_id: Snowflake;
};

export const watch$ = (fromDispatch: Dispatch, rest: Routes) =>
  Resources.watch$(fromDispatch, {
    id: (i: PartialInvite) => i.code,
    init: (guild) =>
      Rx.from(rest.getGuildInvites(guild.id)).pipe(
        RxO.mergeMap(identity),
        RxO.map((i): any => ({
          ...i,
          channel_id: i.channel!.id,
        })),
      ),

    create$: fromDispatch("INVITE_CREATE").pipe(
      RxO.map((c) => [c.guild_id!, c] as const),
    ),
    delete$: fromDispatch("INVITE_DELETE").pipe(
      RxO.map((c) => [c.guild_id!, c.code] as const),
    ),
  });
