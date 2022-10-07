import { Client } from "droff";
import {
  ApplicationCommandInteractionDataOption,
  CreateGlobalApplicationCommandParams,
  CreateGuildApplicationCommandParams,
  Guild,
  GuildMember,
  Interaction,
  InteractionCallbackMessage,
  InteractionType,
  Message,
  User,
} from "droff/types";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import { Map } from "immutable";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as Commands from "./commands";
import { filterByName } from "./operators";
import * as Sync from "./sync";
import * as Utils from "./utils";

interface GuildCommandOptions {
  /** Used for enabling / disabling commands per guild */
  enabled?: (guild: Guild) => Rx.Observable<boolean>;
}

export type GlobalCommand = CreateGlobalApplicationCommandParams;

export type GuildCommand = CreateGuildApplicationCommandParams &
  Required<GuildCommandOptions>;

export type GuildCommandCreate = CreateGuildApplicationCommandParams &
  GuildCommandOptions;

export interface InteractionContext {
  /** The interaction object */
  interaction: Interaction;
  /** The guild member who sent the interaction */
  member?: GuildMember;
  /** The user who sent the interaction (in a DM) */
  user?: User;
  /** The target of the message command */
  targetMessage?: Message;
  /** The target of the user command */
  targetUser?: User;
  /** The focused option for autocomplete */
  focusedOption?: ApplicationCommandInteractionDataOption;

  /** Respond to the interaction immediately */
  respond: Commands.RespondFn;
  /** Follow up message when using deferred */
  editResponse: (data: InteractionCallbackMessage) => Promise<any>;
}

export interface InteractionsHelper {
  /** Create a global slash command */
  global: (command: GlobalCommand) => Rx.Observable<InteractionContext>;
  /**
   * Create a guild-level interaction.
   *
   * It is only recommended to use guild commands for testing purposes.
   * For large bots, you will very likely hit rate limits.
   */
  guild: (command: GuildCommandCreate) => Rx.Observable<InteractionContext>;
  /**
   * Listen for the given InteractionType
   */
  interaction: (type: InteractionType) => Rx.Observable<InteractionContext>;
  /**
   * An observable of side effects. By `subscribe`-ing you start the syncing of
   * commands to Discord.
   *
   * It is not required for the commands to function, but you would then have to
   * manually create any commands using the API.
   */
  sync$: Rx.Observable<void>;
}

/**
 * Create the interaction helpers by passing in a droff client.
 *
 * ```
 * import * as Interactions from "droff-interactions";
 *
 * const interactions = Interactions.create(client);
 *
 * const ping$ = interactions.global({
 *   name: "ping",
 *   description: "A simple ping command",
 * }).pipe(RxO.flatMap(...));
 *
 * Rx.merge(interactions.sync$, ping$).subscribe();
 * ```
 */
export const create = (client: Client): InteractionsHelper => {
  const { fromDispatch } = client;
  const application$ = client.fromDispatch("READY").pipe(
    RxO.map((e) => e.application),
    RxO.shareReplay(1),
  );

  // Response helpers
  const respond = Commands.respond(client);
  const editOriginal = Commands.editOriginal(client);
  const createContext = (interaction: Interaction): InteractionContext => ({
    interaction,
    member: interaction.member,
    user: interaction.user,
    targetMessage: pipe(Utils.targetMessage(interaction), O.toUndefined),
    targetUser: pipe(Utils.targetUser(interaction), O.toUndefined),
    focusedOption: pipe(Utils.focusedOption(interaction), O.toUndefined),
    respond: respond(interaction),
    editResponse: editOriginal(interaction),
  });

  // Shared command create observable
  const interactionCreate = Utils.memoize((type: InteractionType) =>
    fromDispatch("INTERACTION_CREATE").pipe(
      RxO.filter((i) => i.type === type),
      RxO.map(createContext),
      RxO.share(),
    ),
  );
  const applicationCommand$ = interactionCreate(
    InteractionType.APPLICATION_COMMAND,
  );

  // Command creation functions
  let globalCommands = Map<string, CreateGlobalApplicationCommandParams>();
  const global = (command: GlobalCommand) => {
    globalCommands = globalCommands.set(command.name, command);

    return applicationCommand$.pipe(filterByName(command.name));
  };

  let guildCommands = Map<string, GuildCommand>();
  const guild = (command: GuildCommandCreate) => {
    guildCommands = guildCommands.set(command.name, {
      ...command,
      enabled: command.enabled || (() => Rx.of(true)),
    });

    return applicationCommand$.pipe(filterByName(command.name));
  };

  // Sync
  const globalSync$ = Sync.global(client, application$)(() => globalCommands);

  const guildSync$ = Sync.guild(client, application$)(() => guildCommands);

  // Effects
  const sync$ = Rx.merge(globalSync$, guildSync$).pipe(RxO.ignoreElements());

  return {
    global,
    guild,
    interaction: interactionCreate,
    sync$,
  };
};
