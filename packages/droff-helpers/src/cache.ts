import { WatchOp } from "droff/caches/resources";

export const filterWatch =
  <T>(f: (resource: T) => boolean) =>
  (op: WatchOp<T>): WatchOp<T> =>
    op.event === "create" || op.event === "update"
      ? f(op.resource)
        ? op
        : { ...op, event: "delete" }
      : op;

export const mapWatch =
  <T, R>(f: (resource: T) => R) =>
  (op: WatchOp<T>): WatchOp<R> =>
    op.event === "create" || op.event === "update"
      ? { ...op, resource: f(op.resource) }
      : op;
