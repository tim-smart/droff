import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import { Role } from "../types";
import * as Resources from "./resources";

export const watch$ = (fromDispatch: Dispatch) =>
  Resources.watch$<Role>(fromDispatch, "roles", {
    id: (role) => role.id,

    create$: fromDispatch("GUILD_ROLE_CREATE").pipe(
      RxO.map(({ role, guild_id }) => [guild_id, role] as const),
    ),
    update$: fromDispatch("GUILD_ROLE_UPDATE").pipe(
      RxO.map(({ role, guild_id }) => [guild_id, role] as const),
    ),
    delete$: fromDispatch("GUILD_ROLE_DELETE").pipe(
      RxO.map(({ role_id, guild_id }) => [guild_id, role_id] as const),
    ),
  });
