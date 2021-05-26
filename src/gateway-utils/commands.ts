import { Map } from "immutable";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Routes } from "../rest/client";
import { Guild, Message, MessageCreateEvent, Snowflake } from "../types";

export type CommandPrefix =
  | string
  | ((guild: Guild | undefined) => Promise<string>);

export interface CommandOptions {
  name: string;
}

export interface CommandContext {
  guild: Guild | undefined;
  message: Message;
  command: string;
  args: string[];
  reply: (message: string) => Promise<Message>;
}

function escapeRegex(string: string) {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}

export const command$ =
  (
    client: Routes,
    guilds$: Rx.Observable<Map<Snowflake, Guild>>,
    message$: Rx.Observable<MessageCreateEvent>,
  ) =>
  (prefix: CommandPrefix) =>
  ({ name }: CommandOptions) =>
    message$.pipe(
      RxO.withLatestFrom(guilds$),
      RxO.flatMap(([message, guilds]) => {
        const guild = guilds.get(message.guild_id!);
        const ctx = {
          guild,
          message,
          command: name,
          reply: reply(client)(message),
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
        ([ctx, prefix]): CommandContext => ({
          ...ctx,
          args: ctx.message.content
            .slice(prefix.length + name.length)
            .trim()
            .replace(/\s+/g, " ")
            .split(" "),
        }),
      ),
    );

const reply = (client: Routes) => (message: Message) => (content: string) =>
  client.createMessage(message.channel_id, {
    message_reference: { message_id: message.id },
    content,
  });
