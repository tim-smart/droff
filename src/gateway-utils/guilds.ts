import {
  APIGuild,
  GatewayDispatchEvents as E,
  Snowflake,
} from "discord-api-types/v8";
import { Map } from "immutable";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as GatewayClient from "../gateway/client";

const withOp =
  <K extends string>(key: K) =>
  <T>(data: T) =>
    [key, data] as const;

export const watch$ = (dispatch$: GatewayClient.Client["dispatch$"]) =>
  Rx.merge(
    Rx.of(["init"] as const),
    dispatch$(E.GuildCreate).pipe(RxO.map(withOp("create"))),
    dispatch$(E.GuildUpdate).pipe(RxO.map(withOp("update"))),
    dispatch$(E.GuildDelete).pipe(RxO.map(withOp("delete"))),
  ).pipe(
    RxO.scan((map, op) => {
      if (op[0] === "init") return map;
      return op[0] === "delete"
        ? map.delete(op[1].id)
        : map.set(op[1].id, op[1]);
    }, Map<Snowflake, APIGuild>()),
    RxO.shareReplay(1),
  );
