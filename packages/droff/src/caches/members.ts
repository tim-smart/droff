import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import { GuildMember } from "../types";
import * as Resources from "./resources";

export const watch$ = (dispatch$: Dispatch) =>
  Resources.watch$(dispatch$, "members", {
    id: (member: GuildMember) => member.user!.id,
    create$: Rx.merge(
      dispatch$("GUILD_MEMBERS_CHUNK").pipe(
        RxO.flatMap((chunk) =>
          Rx.from(chunk.members).pipe(
            RxO.map((member) => [chunk.guild_id, member] as const),
          ),
        ),
      ),
      dispatch$("GUILD_MEMBER_ADD").pipe(
        RxO.map((member) => [member.guild_id, member] as const),
      ),
    ),
    update$: dispatch$("GUILD_MEMBER_UPDATE").pipe(
      RxO.map((member) => [member.guild_id, member as GuildMember]),
    ),
    delete$: dispatch$("GUILD_MEMBER_REMOVE").pipe(
      RxO.map((member) => [member.guild_id, member.user.id]),
    ),
  });
