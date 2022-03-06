import { Client } from "droff";
import {
  ActionRow,
  ApplicationCommandInteractionDataOption,
  ApplicationCommandPermission,
  Component,
  CreateGlobalApplicationCommandParams,
  CreateGuildApplicationCommandParams,
  Guild,
  GuildMember,
  Interaction,
  InteractionCallbackAutocomplete,
  InteractionCallbackMessage,
  InteractionCallbackModal,
  InteractionCallbackType,
  InteractionType,
  Message,
  User,
} from "droff/dist/types";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import { Map } from "immutable";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as Commands from "./commands";
import * as Sync from "./sync";
import * as Utils from "./utils";

interface GuildCommandOptions {
  /** Used for enabling / disabling commands per guild */
  enabled?: (guild: Guild) => Rx.Observable<boolean>;
  /** Used for setting permissions for the command per guild */
  permissions?: (guild: Guild) => Rx.Observable<ApplicationCommandPermission>;
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
  global: (
    command: GlobalCommand,
    create?: boolean,
  ) => Rx.Observable<InteractionContext>;
  /**
   * Create a guild-level interaction.
   *
   * It is only recommended to use guild commands for testing purposes.
   * For large bots, you will very likely hit rate limits.
   */
  guild: (command: GuildCommandCreate) => Rx.Observable<InteractionContext>;
  /**
   * Listen for autocomplete requests for the given command and option
   */
  autocomplete: (
    command: string,
    option: string,
  ) => Rx.Observable<InteractionContext>;
  /**
   * Listen for modal submit requests for the given custom_id
   */
  modalSubmit: (customID: string) => Rx.Observable<InteractionContext>;
  /**
   * Listen to component interactions. Pass in a `custom_id` to determine what
   * interfactions to listen for.
   *
   * You can also pass in a `RegExp`. For example, this would match both
   * "button_1" and "button_2":
   *
   * ```
   * commands.component(/^button_/).subscribe()
   * ```
   */
  component: (customID: string | RegExp) => Rx.Observable<InteractionContext>;
  /** Listen to multiple component interactions */
  components: (
    components: Exclude<Component, ActionRow>[],
  ) => Rx.Observable<readonly [InteractionContext, Component]>;
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
  effects$: Rx.Observable<void>;
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
 * Rx.merge(interactions.effects$, ping$).subscribe();
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

  // Set permissions fn
  const setPermissions = Commands.setPermissions(client);

  // Shared command create observable
  const interactionCreate = (type: InteractionType) =>
    fromDispatch("INTERACTION_CREATE").pipe(
      RxO.filter((i) => i.type === type),
      RxO.map(createContext),
      RxO.share(),
    );
  const applicationCommand$ = interactionCreate(
    InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
  );
  const interactionAutocomplete$ = interactionCreate(
    InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
  );
  const interactionModalSubmit$ = interactionCreate(
    InteractionType.MODAL_SUBMIT,
  );
  const interactionComponent$ = interactionCreate(
    InteractionType.MESSAGE_COMPONENT,
  );

  // Command creation functions
  let globalCommands = Map<string, CreateGlobalApplicationCommandParams>();
  const global = (command: GlobalCommand, create = false) => {
    globalCommands = globalCommands.set(command.name, command);

    const create$ = application$.pipe(
      RxO.flatMap((app) =>
        client.createGlobalApplicationCommand(app.id, command),
      ),
    );

    return Rx.iif(() => create, create$, Rx.of(0)).pipe(
      // Switch to emitting the interactions
      RxO.switchMap(() => applicationCommand$),
      RxO.filter(({ interaction }) => interaction.data!.name === command.name),
    );
  };

  let guildCommands = Map<string, GuildCommand>();
  const guild = (command: GuildCommandCreate) => {
    guildCommands = guildCommands.set(command.name, {
      ...command,
      enabled: command.enabled || (() => Rx.of(true)),
      permissions: command.permissions || (() => Rx.EMPTY),
    });

    return applicationCommand$.pipe(
      RxO.filter(({ interaction }) => interaction.data!.name === command.name),
    );
  };

  const autocomplete = (command: string, option: string) =>
    interactionAutocomplete$.pipe(
      RxO.filter(
        ({ interaction, focusedOption }) =>
          interaction.data!.name === command && focusedOption?.name === option,
      ),
    );

  const modalSubmit = (customID: string) =>
    interactionModalSubmit$.pipe(
      RxO.filter(({ interaction }) => interaction.data!.custom_id === customID),
    );

  const component = (customID: string | RegExp) =>
    interactionComponent$.pipe(
      RxO.filter(({ interaction }) =>
        customID instanceof RegExp
          ? customID.test(interaction.data!.custom_id || "")
          : interaction.data!.custom_id === customID,
      ),
    );

  const components = (components: Exclude<Component, ActionRow>[]) => {
    const map = components
      .filter(({ custom_id }) => !!custom_id)
      .reduce((map, c) => map.set(c.custom_id!, c), Map<string, Component>());

    return interactionComponent$.pipe(
      RxO.filter(({ interaction }) =>
        map.has(interaction.data!.custom_id || ""),
      ),
      RxO.map(
        (ctx) =>
          [ctx, map.get(ctx.interaction.data!.custom_id || "")!] as const,
      ),
    );
  };

  // Respond to pings
  const pingPong$ = fromDispatch("INTERACTION_CREATE").pipe(
    RxO.filter((i) => i.type === InteractionType.PING),
    RxO.flatMap((ping) =>
      client.createInteractionResponse(ping.id, ping.token, {
        type: InteractionCallbackType.PONG,
      }),
    ),
  );

  // Sync
  const { removeGlobalCommands$ } = Sync.global(
    client,
    application$,
  )(() => globalCommands);
  const { removeGuildCommands$, enableGuildCommands$, disableGuildCommands$ } =
    Sync.guild(client, application$, setPermissions)(() => guildCommands);

  // Effects
  const effects$ = Rx.merge(
    pingPong$,
    removeGlobalCommands$,
    removeGuildCommands$,
    enableGuildCommands$,
    disableGuildCommands$,
  ).pipe(RxO.map(() => {}));

  return {
    global,
    guild,
    autocomplete,
    modalSubmit,
    component,
    components,
    interaction: interactionCreate,
    effects$,
  };
};
