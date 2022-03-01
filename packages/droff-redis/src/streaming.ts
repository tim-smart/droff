import { Client } from "droff";
import { GatewayPayload, GuildCreateEvent } from "droff/dist/types";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { CreateStoreOpts } from "./cache-store";

export const pushPayloads =
  ({ client, prefix = "droff" }: CreateStoreOpts) =>
  ({ dispatch$ }: Pick<Client, "dispatch$">): Rx.Observable<void> => {
    const key = `${prefix}:gateway`;

    return dispatch$.pipe(
      // Strip out initial guild create data
      RxO.map((p) => {
        if (p.t !== "GUILD_CREATE") return p;

        const data = p.d as GuildCreateEvent;
        return {
          ...p,
          d: {
            ...data,
            roles: [],
            emojis: [],
            channels: [],
            members: [],
          },
        };
      }),
      RxO.flatMap((payload) =>
        client.rPush(key, JSON.stringify(payload)).catch((err) => {
          console.error(`Error in push: ${err}`);
        }),
      ),
      RxO.ignoreElements(),
    );
  };

export const pullPayloads =
  ({ client: parentClient, prefix = "droff" }: CreateStoreOpts) =>
  (): Rx.Observable<GatewayPayload> => {
    const client = parentClient.duplicate();
    const key = `${prefix}:gateway`;

    const pull: T.Task<GatewayPayload> = pipe(
      TE.tryCatch(
        () => client.blPop(key, 30),
        (err) => `BLPOP: ${err}`,
      ),
      TE.chainOptionK(() => "")(O.fromNullable),
      TE.chain(
        TE.tryCatchK(
          async (data) => JSON.parse(data.element),
          (err) => `Parsing JSON: ${err}`,
        ),
      ),
      TE.getOrElse((err) => {
        if (err) {
          console.error(`Error in pull: ${err}`);
        }
        return pull;
      }),
    );

    return new Rx.Observable<GatewayPayload>((s) => {
      client.connect();
      let cancelled = false;

      const tick = () =>
        pull().then((payload) => {
          if (cancelled) return;
          s.next(payload);
          tick();
        });

      tick();

      s.add(() => {
        cancelled = true;
        client.disconnect();
      });
    });
  };
