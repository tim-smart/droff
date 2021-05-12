import { APIGuildMember, GatewayDispatchEvents } from "discord-api-types";
import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import * as Resources from "./resources";

export const watch$ = (dispatch$: Dispatch) =>
  Resources.watch$(dispatch$, "members", {
    id: (member: APIGuildMember) => member.user!.id,
    create$: dispatch$(GatewayDispatchEvents.GuildMemberAdd).pipe(
      RxO.map((member) => [member.guild_id, member]),
    ),
    update$: dispatch$(GatewayDispatchEvents.GuildMemberUpdate).pipe(
      RxO.map((member) => [member.guild_id, member as APIGuildMember]),
    ),
    delete$: dispatch$(GatewayDispatchEvents.GuildMemberRemove).pipe(
      RxO.map((member) => [member.guild_id, member.user.id]),
    ),
  });
