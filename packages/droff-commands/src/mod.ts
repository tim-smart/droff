import { Client } from "droff";
import { NonParentCacheStore } from "droff/caches/stores";
import { CreateMessageParams, Guild, Message } from "droff/types";
import { Args, Lexer, longShortStrategy, Parser, Token } from "lexure";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";

export type CommandPrefix =
  | string
  | ((guild: Guild | undefined) => Promise<string>);

export interface CreateOptions {
  /**
   * The droff client
   */
  client: Client;

  /**
   * The guilds cache is required
   */
  guildsCache: NonParentCacheStore<Guild>;

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

export interface CommandContext<M> {
  /**
   * The guild the channel was in. Is `undefined` if the message was a DM.
   */
  guild: Guild | undefined;

  /**
   * The prefix for the current guild
   */
  prefix: string;

  /**
   * The `Message` object
   */
  message: Message;

  /**
   * A map of all the available commands
   */
  commands: ReadonlyMap<string, CommandOptions & M>;

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
export type CreateCommandFn<M> = (
  config: CommandOptions & M,
) => Rx.Observable<CommandContext<M> & M>;

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
export const create = <M>({
  client,
  guildsCache: guildCache,
  prefix = "!",
  filterBotMessages = true,
  createLexer,
  createParser,
}: CreateOptions): CreateCommandFn<M> => {
  const commands = new Map<string, CommandOptions & M>();
  const parse = parseCommand(createLexer, createParser);
  const replyFn = reply(client);

  const messages$ = client.fromDispatch("MESSAGE_CREATE").pipe(
    filterBotMessages
      ? RxO.filter(({ author }) => author.bot !== true)
      : (o) => o,

    RxO.flatMap((message) =>
      Rx.zip(Rx.of(message), guildCache.get(message.guild_id!)),
    ),
    RxO.flatMap(([message, guild]) =>
      Rx.zip(
        typeof prefix === "string" ? Rx.of(prefix) : prefix(guild),
        Rx.of(message),
        Rx.of(guild),
      ),
    ),

    RxO.filter(([prefix, message]) => message.content.startsWith(prefix)),
    RxO.flatMap(
      ([prefix, message, guild]): Rx.Observable<CommandContext<M> & M> => {
        const [command, args] = parse(prefix, message);
        const opts = commands.get(command);
        if (!opts) return Rx.EMPTY;

        return Rx.of({
          ...opts,
          commands,
          command,
          guild,
          prefix,
          message,
          reply: replyFn(message),
          args,
        });
      },
    ),

    RxO.share(),
  );

  return (opts) => {
    commands.set(opts.name, opts);
    return messages$.pipe(RxO.filter(({ command }) => command === opts.name));
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
