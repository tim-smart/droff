import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import { GuildMember } from "../types";
import * as Resources from "./resources";

export const watch$ = (fromDispatch: Dispatch) =>
  Resources.watch$(fromDispatch, {
    id: (member: GuildMember) => member.user!.id,
    init: (g) => Rx.from(g.members ?? []),
    create$: Rx.merge(
      fromDispatch("GUILD_MEMBERS_CHUNK").pipe(
        RxO.flatMap((chunk) =>
          Rx.from(chunk.members).pipe(
            RxO.map((member) => [chunk.guild_id, member] as const),
          ),
        ),
      ),
      fromDispatch("GUILD_MEMBER_ADD").pipe(
        RxO.map((member) => [member.guild_id, member] as const),
      ),
    ),
    update$: fromDispatch("GUILD_MEMBER_UPDATE").pipe(
      RxO.map((member) => [member.guild_id, member as unknown as GuildMember]),
    ),
    delete$: fromDispatch("GUILD_MEMBER_REMOVE").pipe(
      RxO.map((member) => [member.guild_id, member.user.id]),
    ),
  });
