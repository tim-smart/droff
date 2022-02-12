import { Client } from "droff";
import { CreateMessageParams, Guild, Message } from "droff/dist/types";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Args, Lexer, longShortStrategy, Parser, Token } from "lexure";

export type CommandPrefix =
  | string
  | ((guild: Guild | undefined) => Promise<string>);

export interface CreateOptions {
  /**
   * Set the prefix. Defaults to "!"
   */
  prefix?: CommandPrefix;

  /**
   * Do you want to filter out message's from bot users?
   *
   * Defaults to `true`
   */
  filterBotMessages?: boolean;

  /**
   * Create a custom `lexure.Lexer` for parsing commands.
   */
  createLexer?: (content: string) => Lexer;

  /**
   * Create a custom `lexure.Parser` for parsing commands.
   */
  createParser?: (tokens: Token[]) => Parser;
}

export interface CommandOptions {
  /** The name for the command, excluding the prefix */
  name: string;
}

export interface CommandContext {
  /**
   * The guild the channel was in. Is `undefined` if the message was a DM.
   */
  guild: Guild | undefined;

  /**
   * The `Message` object
   */
  message: Message;

  /**
   * The name of the command that was received.
   */
  command: string;

  /**
   * The `lexure.Args` instance, from parsing the command + arguments.
   */
  args: Args;

  /**
   * Helper method for quickly replying to a message.
   */
  reply: (message: Partial<CreateMessageParams>) => Promise<Message>;
}
export type CreateCommandFn = (
  config: CommandOptions,
) => Rx.Observable<CommandContext>;

const parseCommand =
  (
    createLexer: CreateOptions["createLexer"] = (content) =>
      new Lexer(content).setQuotes([
        ['"', '"'],
        ["'", "'"],
      ]),
    createParser: CreateOptions["createParser"] = (tokens) =>
      new Parser(tokens).setUnorderedStrategy(longShortStrategy()),
  ) =>
  (prefix: string, message: Message) => {
    const lexer = createLexer(message.content);
    const [command, getTokens] = lexer.lexCommand(() => prefix.length)!;
    const parser = createParser(getTokens());
    return [command.value, new Args(parser.parse())] as const;
  };

/**
 * Create a instance of the command helper utility. You pass in a droff client
 * and specify a prefix or prefix function.
 *
 * Example:
 *
 * ```
 * import * as Commands from "droff-commands";
 *
 * const createCommand = Commands.create(client)("!");
 *
 * const createCommandWithCustomPrefix = Commands.create(client)(async (guild) =>
 *   getPrefixForGuild(guild),
 * );
 * ```
 */
export const create = (
  client: Client,
  {
    prefix = "!",
    filterBotMessages = true,
    createLexer,
    createParser,
  }: CreateOptions = {},
): CreateCommandFn => {
  const parse = parseCommand(createLexer, createParser);

  const messages$ = client.fromDispatch("MESSAGE_CREATE").pipe(
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

    RxO.share(),
  );

  return ({ name }) => {
    return messages$.pipe(
      RxO.filter(({ command }) => command === name),

      RxO.map(
        (ctx): CommandContext => ({
          ...ctx,
          reply: reply(client)(ctx.message),
        }),
      ),
    );
  };
};

const reply =
  (client: Client) =>
  (message: Message) =>
  (content: Partial<CreateMessageParams>) =>
    client.createMessage(message.channel_id, {
      message_reference: { message_id: message.id },
      ...content,
    });
