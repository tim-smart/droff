import { Client } from "droff";
import {
  ApplicationCommandPermission,
  Component,
  CreateGlobalApplicationCommandParams,
  CreateGuildApplicationCommandParams,
  Guild,
  GuildMember,
  Interaction,
  InteractionApplicationCommandCallbackDatum,
  InteractionCallbackType,
  InteractionType,
  User,
} from "droff/dist/types";
import * as F from "fp-ts/function";
import { Map } from "immutable";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as Commands from "./commands";
import * as Sync from "./sync";

interface CommandOptions {
  /** Used for setting permissions for the command per guild */
  permissions?: (guild: Guild) => Rx.Observable<ApplicationCommandPermission>;
}

interface GuildCommandOptions {
  /** Used for enabling / disabling commands per guild */
  enabled?: (guild: Guild) => Rx.Observable<boolean>;
}

export type GlobalCommand = CreateGlobalApplicationCommandParams &
  CommandOptions;

export type GuildCommand = CreateGuildApplicationCommandParams &
  Required<GuildCommandOptions> &
  CommandOptions;

export type GuildCommandCreate = CreateGuildApplicationCommandParams &
  GuildCommandOptions &
  CommandOptions;

export interface SlashCommandContext {
  /** The interaction object */
  interaction: Interaction;
  /** The guild member who sent the interaction */
  member?: GuildMember;
  /** The user who sent the interaction (in a DM) */
  user?: User;

  /** Respond to the interaction immediately */
  respond: (data: InteractionApplicationCommandCallbackDatum) => Promise<any>;
  /** Respond to the interaction later with editResponse */
  defer: () => Promise<any>;
  /** Update the original message (components only) */
  update: (data: InteractionApplicationCommandCallbackDatum) => Promise<any>;
  /** Update the original message later (components only) */
  deferUpdate: () => Promise<any>;
  /** Follow up message when using deferred */
  editResponse: (
    data: InteractionApplicationCommandCallbackDatum,
  ) => Promise<any>;
}

export interface SlashCommandsHelper {
  /** Create a global slash command */
  global: (
    command: GlobalCommand,
    create?: boolean,
  ) => Rx.Observable<SlashCommandContext>;
  /** Create a guild slash command */
  guild: (command: GuildCommandCreate) => Rx.Observable<SlashCommandContext>;
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
  component: (customID: string | RegExp) => Rx.Observable<SlashCommandContext>;
  /** Listen to multiple component interactions */
  components: (
    components: Component[],
  ) => Rx.Observable<readonly [SlashCommandContext, Component]>;
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
export const create = (client: Client): SlashCommandsHelper => {
  const { fromDispatch, application$, guilds$ } = client;

  // Response helpers
  const respond = Commands.respond(
    client,
    InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
  );
  const respondDeferred = Commands.respond(
    client,
    InteractionCallbackType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
  );
  const update = Commands.respond(
    client,
    InteractionCallbackType.UPDATE_MESSAGE,
  );
  const updateDeferred = Commands.respond(
    client,
    InteractionCallbackType.DEFERRED_UPDATE_MESSAGE,
  );
  const editOriginal = Commands.editOriginal(client);
  const createContext = (interaction: Interaction): SlashCommandContext => ({
    interaction,
    member: interaction.member,
    user: interaction.user,
    respond: respond(interaction),
    defer: respondDeferred(interaction),
    update: update(interaction),
    deferUpdate: updateDeferred(interaction),
    editResponse: editOriginal(interaction),
  });

  // Set permissions fn
  const setPermissions = Commands.setPermissions(client);

  // Shared command create observable
  const interactionCreate$ = fromDispatch("INTERACTION_CREATE").pipe(
    RxO.filter((i) => i.type === InteractionType.APPLICATION_COMMAND),
    RxO.map(createContext),
    RxO.share(),
  );

  const interactionComponent$ = fromDispatch("INTERACTION_CREATE").pipe(
    RxO.filter((i) => i.type === InteractionType.MESSAGE_COMPONENT),
    RxO.map(createContext),
    RxO.share(),
  );

  // Command creation functions
  let globalCommands = Map<string, CreateGlobalApplicationCommandParams>();
  const global = (command: GlobalCommand, create = false) => {
    globalCommands = globalCommands.set(command.name, command);

    const create$ = application$.pipe(
      RxO.flatMap((app) =>
        client.createGlobalApplicationCommand(app.id, command),
      ),

      // Update permissions
      RxO.withLatestFrom(guilds$),
      RxO.flatMap(([apiCommand, guilds]) =>
        F.pipe(
          Rx.from(guilds.values()),
          RxO.flatMap((guild) => setPermissions(guild, command, apiCommand)),
          RxO.last(),
        ),
      ),
    );

    return Rx.iif(() => create, create$, Rx.of(0)).pipe(
      // Switch to emitting the interactions
      RxO.switchMap(() => interactionCreate$),
      RxO.filter(({ interaction }) => interaction.data!.name === command.name),
    );
  };

  let guildCommands = Map<string, GuildCommand>();
  const guild = (command: GuildCommandCreate) => {
    guildCommands = guildCommands.set(command.name, {
      ...command,
      enabled: command.enabled || (() => Rx.of(true)),
    });

    return interactionCreate$.pipe(
      RxO.filter(({ interaction }) => interaction.data!.name === command.name),
    );
  };

  const component = (customID: string | RegExp) =>
    interactionComponent$.pipe(
      RxO.filter(({ interaction }) =>
        customID instanceof RegExp
          ? customID.test(interaction.data!.custom_id)
          : interaction.data!.custom_id === customID,
      ),
    );

  const components = (components: Component[]) => {
    const map = components
      .filter(({ custom_id }) => !!custom_id)
      .reduce((map, c) => map.set(c.custom_id!, c), Map<string, Component>());

    return interactionComponent$.pipe(
      RxO.filter(({ interaction }) => map.has(interaction.data!.custom_id)),
      RxO.map(
        (ctx) => [ctx, map.get(ctx.interaction.data!.custom_id)!] as const,
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
  const { removeGlobalCommands$ } = Sync.global(client)(() => globalCommands);
  const { removeGuildCommands$, enableGuildCommands$, disableGuildCommands$ } =
    Sync.guild(client, setPermissions)(() => guildCommands);

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
    component,
    components,
    effects$,
  };
};
