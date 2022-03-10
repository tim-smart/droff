import { from } from "rxjs";
import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import { StageInstance } from "../types";
import * as Resources from "./resources";

export const watch$ = (fromDispatch: Dispatch) =>
  Resources.watch$(fromDispatch, {
    id: (s: StageInstance) => s.id,
    init: (g) => from(g.stage_instances ?? []),
    create$: fromDispatch("STAGE_INSTANCE_CREATE").pipe(
      RxO.map((c) => [c.guild_id!, c] as const),
    ),
    update$: fromDispatch("STAGE_INSTANCE_UPDATE").pipe(
      RxO.map((c) => [c.guild_id!, c] as const),
    ),
    delete$: fromDispatch("STAGE_INSTANCE_DELETE").pipe(
      RxO.map((c) => [c.guild_id!, c.id] as const),
    ),
  });
