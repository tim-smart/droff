import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import { Role } from "../types";
import * as Resources from "./resources";

export const watch$ = (dispatch$: Dispatch) =>
  Resources.watch$<Role>(dispatch$, "roles", {
    id: (role) => role.id,

    create$: dispatch$("GUILD_ROLE_CREATE").pipe(
      RxO.map(({ role, guild_id }) => [guild_id, role] as const),
    ),
    update$: dispatch$("GUILD_ROLE_UPDATE").pipe(
      RxO.map(({ role, guild_id }) => [guild_id, role] as const),
    ),
    delete$: dispatch$("GUILD_ROLE_DELETE").pipe(
      RxO.map(({ role_id, guild_id }) => [guild_id, role_id] as const),
    ),
  });
