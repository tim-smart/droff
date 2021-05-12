import { APIRole, GatewayDispatchEvents } from "discord-api-types";
import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import * as Resources from "./resources";

export const watch$ = (dispatch$: Dispatch) =>
  Resources.watch$<APIRole>(dispatch$, "roles", {
    id: (role) => role.id,

    create$: dispatch$(GatewayDispatchEvents.GuildRoleCreate).pipe(
      RxO.map(({ role, guild_id }) => [guild_id, role] as const),
    ),
    update$: dispatch$(GatewayDispatchEvents.GuildRoleUpdate).pipe(
      RxO.map(({ role, guild_id }) => [guild_id, role] as const),
    ),
    delete$: dispatch$(GatewayDispatchEvents.GuildRoleDelete).pipe(
      RxO.map(({ role_id, guild_id }) => [guild_id, role_id] as const),
    ),
  });
