import { APIGuildMember, GatewayDispatchEvents } from "discord-api-types";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import * as Resources from "./resources";

export const watch$ = (dispatch$: Dispatch) =>
  Resources.watch$(dispatch$, "members", {
    id: (member: APIGuildMember) => member.user!.id,
    create$: Rx.merge(
      dispatch$(GatewayDispatchEvents.GuildMembersChunk).pipe(
        RxO.flatMap((chunk) =>
          Rx.from(chunk.members).pipe(
            RxO.map((member) => [chunk.guild_id, member] as const),
          ),
        ),
      ),
      dispatch$(GatewayDispatchEvents.GuildMemberAdd).pipe(
        RxO.map((member) => [member.guild_id, member] as const),
      ),
    ),
    update$: dispatch$(GatewayDispatchEvents.GuildMemberUpdate).pipe(
      RxO.map((member) => [member.guild_id, member as APIGuildMember]),
    ),
    delete$: dispatch$(GatewayDispatchEvents.GuildMemberRemove).pipe(
      RxO.map((member) => [member.guild_id, member.user.id]),
    ),
  });
