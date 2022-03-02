import { Task } from "fp-ts/lib/Task";

export interface ClaimIdContext {
  sharderId: string;
  sharderCount: number;
  totalCount: number;
}

export interface SharderStore {
  claimId: (ctx: ClaimIdContext) => Task<number | undefined>;

  /** droff calls this function every 30s for each shard */
  heartbeat: (shardId: number) => Task<void>;
}

// Very basic shard id store, that does no health checks
export const memoryStore = (): SharderStore => {
  let currentId = 0;

  return {
    claimId:
      ({ totalCount }) =>
      async () => {
        if (currentId >= totalCount) return undefined;
        const id = currentId;
        currentId++;
        return id;
      },

    heartbeat: (_id) => async () => {},
  };
};
