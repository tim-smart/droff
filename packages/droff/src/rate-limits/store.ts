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

  getCounter: (key: string) => Promise<Counter | undefined>;
  incrementCounter: (key: string, window: number) => Promise<void>;
}

export const maybeWait =
  (store: Store) =>
  (key: string, window: number, limit: number): T.Task<void> =>
    F.pipe(
      TO.tryCatch(() => store.getCounter(key)),
      TO.chainNullableK(F.identity),
      TO.filter(({ expires }) => expires > Date.now()),
      TO.getOrElse(() =>
        T.of({
          expires: Date.now() + window,
          count: 0,
        }),
      ),
      T.chain(({ count, expires }) =>
        count >= limit
          ? F.pipe(
              T.of(null),
              T.delay(expires - Date.now()),
              T.chain(() => maybeWait(store)(key, window, limit)),
            )
          : F.pipe(
              TO.tryCatch(() => store.incrementCounter(key, window)),
              TO.getOrElse(() => () => Promise.resolve()),
            ),
      ),
    );
