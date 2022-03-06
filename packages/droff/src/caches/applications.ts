import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import { Application } from "../types";
import { WatchOp } from "./resources";

export const watch$ = (fromDispatch: Dispatch) =>
  fromDispatch("READY").pipe(
    RxO.map(
      (ready): WatchOp<Application> => ({
        event: "create",
        resourceId: ready.application.id,
        resource: ready.application,
      }),
    ),
  );
