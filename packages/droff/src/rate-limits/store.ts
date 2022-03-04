import * as F from "fp-ts/function";
import * as T from "fp-ts/Task";
import * as TO from "fp-ts/TaskOption";

export type BucketDetails = {
  key: string;
  resetAfter: number;
  limit: number;
};

export interface Counter {
  /** How many times this counter has been triggered */
  count: number;
  /** When this counter expires */
  expires: number;
}

export interface Store {
  hasBucket: (bucketKey: string) => Promise<boolean>;
  putBucket: (bucket: BucketDetails) => Promise<void>;

  getBucketForRoute: (route: string) => Promise<BucketDetails | undefined>;
  putBucketRoute: (route: string, bucketKey: string) => Promise<void>;

  /**
   * Returns the amount of time needed to wait
   */
  getDelay: (key: string, window: number, limit: number) => Promise<number>;
}

export const maybeWait =
  (store: Store) =>
  (key: string, window: number, limit: number): T.Task<void> => {
    const retry = (delay: number) =>
      F.pipe(
        T.of(undefined),
        T.delay(delay),
        T.chain(() => maybeWait(store)(key, window, limit)),
      );

    return F.pipe(
      TO.tryCatch(() => store.getDelay(key, window, limit)),
      TO.fold(
        () => T.of(undefined),
        (delay) => (delay > 0 ? retry(delay) : T.of(undefined)),
      ),
    );
  };
