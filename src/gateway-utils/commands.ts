import { GatewayMessageCreateDispatchData, Snowflake } from "discord-api-types";
import { APIGuild, APIMessage } from "discord-api-types/payloads/v8";
import * as F from "fp-ts/function";
import * as O from "fp-ts/Option";
import { Map } from "immutable";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";

export type CommandPrefix =
  | string
  | ((guild: APIGuild | undefined) => Promise<string>);

export interface CommandOptions {
  name: string;
}

export interface CommandContext {
  guild: APIGuild | undefined;
  message: APIMessage;
  command: string;
  args: string[];
}

function escapeRegex(string: string) {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}

export const command$ = (
  guilds$: Rx.BehaviorSubject<Map<Snowflake, APIGuild>>,
  message$: Rx.Observable<GatewayMessageCreateDispatchData>,
) => (prefix: CommandPrefix) => ({ name }: CommandOptions) =>
  message$.pipe(
    RxO.flatMap((message) => {
      const guild = guilds$.value.get(message.guild_id!);
      const ctx = {
        guild,
        message,
        command: name,
      };

      return Rx.zip(
        Rx.of(ctx),
        typeof prefix === "string" ? Rx.of(prefix) : prefix(guild),
      );
    }),

    RxO.filter(([ctx, prefix]) =>
      new RegExp(`^${escapeRegex(prefix)}${escapeRegex(name)}\\b`).test(
        ctx.message.content,
      ),
    ),

    RxO.map(
      ([ctx, prefix]) =>
        ({
          ...ctx,
          args: ctx.message.content
            .slice(prefix.length + name.length)
            .trim()
            .replace(/\s+/g, " ")
            .split(" "),
        } as CommandContext),
    ),
  );
