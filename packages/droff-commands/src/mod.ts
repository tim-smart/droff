import { Client } from "droff";
import { Guild, Message } from "droff/dist/types";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Args, Lexer, longShortStrategy, Parser, Token } from "lexure";

export type CommandPrefix =
  | string
  | ((guild: Guild | undefined) => Promise<string>);

export interface CommandOptions {
  name: string;
  filterBotMessages?: boolean;
  createLexer?: (content: string) => Lexer;
  createParser?: (tokens: Token[]) => Parser;
}

export interface CommandContext {
  guild: Guild | undefined;
  message: Message;
  command: string;
  args: Args;
  reply: (message: string) => Promise<Message>;
}

const parseCommand =
  (
    createLexer: CommandOptions["createLexer"] = (content) =>
      new Lexer(content).setQuotes([
        ['"', '"'],
        ["'", "'"],
      ]),
    createParser: CommandOptions["createParser"] = (tokens) =>
      new Parser(tokens).setUnorderedStrategy(longShortStrategy()),
  ) =>
  (prefix: string, message: Message) => {
    const lexer = createLexer(message.content);
    const [command, getTokens] = lexer.lexCommand(() => prefix.length)!;
    const parser = createParser(getTokens());
    return [command.value, new Args(parser.parse())] as const;
  };

export const create =
  (client: Client) =>
  (prefix: CommandPrefix) =>
  ({
    name,
    filterBotMessages = true,
    createLexer,
    createParser,
  }: CommandOptions) => {
    const parse = parseCommand(createLexer, createParser);
    return client.fromDispatch("MESSAGE_CREATE").pipe(
      filterBotMessages
        ? RxO.filter(({ author }) => author.bot !== true)
        : (o) => o,

      RxO.withLatestFrom(client.guilds$),
      RxO.flatMap(([message, guilds]) => {
        const guild = guilds.get(message.guild_id!);

        return Rx.zip(
          typeof prefix === "string" ? Rx.of(prefix) : prefix(guild),
          Rx.of(message),
          Rx.of(guild),
        );
      }),

      RxO.filter(([prefix, message]) => message.content.startsWith(prefix)),
      RxO.map(([prefix, message, guild]) => {
        const [command, args] = parse(prefix, message);
        return { command, args, guild, message };
      }),
      RxO.filter(({ command }) => command === name),

      RxO.map(
        (ctx): CommandContext => ({
          ...ctx,
          reply: reply(client)(ctx.message),
        }),
      ),
    );
  };

const reply = (client: Client) => (message: Message) => (content: string) =>
  client.createMessage(message.channel_id, {
    message_reference: { message_id: message.id },
    content,
  });
