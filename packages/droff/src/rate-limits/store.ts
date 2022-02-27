import * as F from "fp-ts/function";
import * as T from "fp-ts/Task";
import * as TO from "fp-ts/TaskOption";

export type BucketDetails = {
  key: string;
  resetAfter: number;
  limit: number;
};

export interface Counter {
  remaining: number;
  expires: number;
}

export interface Store {
  hasBucket: (bucketKey: string) => Promise<boolean>;
  putBucket: (bucket: BucketDetails) => Promise<void>;

  getBucketForRoute: (route: string) => Promise<BucketDetails | undefined>;
  putBucketRoute: (route: string, bucketKey: string) => Promise<void>;

  getCounter: (key: string) => Promise<Counter | undefined>;
  putCounter: (key: string, counter: Counter) => Promise<void>;
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
          remaining: limit,
        }),
      ),
      T.chain(({ remaining, expires }) =>
        remaining <= 0
          ? F.pipe(
              T.of(null),
              T.delay(expires - Date.now()),
              T.chain(() => maybeWait(store)(key, window, limit)),
            )
          : F.pipe(
              TO.tryCatch(() =>
                store.putCounter(key, {
                  expires,
                  remaining: remaining - 1,
                }),
              ),
              TO.getOrElse(() => () => Promise.resolve()),
            ),
      ),
    );
