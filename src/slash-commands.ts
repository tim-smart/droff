import {
  APIApplicationCommand,
  APIApplicationCommandInteraction,
  APIGuild,
  APIInteractionGuildMember,
  APIInteractionResponseChannelMessageWithSource,
  APIInteractionResponseDeferredChannelMessageWithSource,
  APIUser,
  GatewayDispatchEvents,
  InteractionResponseType,
  InteractionType,
  RESTPostAPIApplicationCommandsJSONBody,
  Snowflake,
} from "discord-api-types/v8";
import * as F from "fp-ts/function";
import * as O from "fp-ts/Option";
import { Map } from "immutable";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as App from "./gateway-utils/applications";
import { Dispatch } from "./gateway/dispatch";
import { Routes } from "./rest/client";

interface GuildCommandOptions {
  enabled: (guild: APIGuild) => Promise<boolean>;
}

export type GuildCommand = RESTPostAPIApplicationCommandsJSONBody &
  GuildCommandOptions;

const isCommandEnabled = (commands: Map<string, GuildCommand>) => (
  guild: APIGuild,
  apiCommand: APIApplicationCommand,
) =>
  F.pipe(
    O.fromNullable(commands.get(apiCommand.name)),
    O.map((opts) => opts.enabled(guild)),
  );

const interactionRespond = <D extends { data?: any }>(
  rest: Routes,
  type: InteractionResponseType,
) => (interaction: APIApplicationCommandInteraction) => (data: D["data"]) =>
  rest.postInteractionCallback([interaction.id, interaction.token], {
    type,
    data,
  });

export interface SlashCommandContext {
  interaction: APIApplicationCommandInteraction;
  member?: APIInteractionGuildMember;
  user?: APIUser;
  guild?: APIGuild;
  respond: (
    data: APIInteractionResponseChannelMessageWithSource["data"],
  ) => Promise<never>;
  deferred: (
    data: APIInteractionResponseDeferredChannelMessageWithSource["data"],
  ) => Promise<never>;
}

export const factory = (
  dispatch$: Dispatch,
  rest: Routes,
  guilds$: Rx.Observable<Map<Snowflake, APIGuild>>,
) => () => {
  const app$ = App.watch$(dispatch$).pipe(RxO.first(), RxO.shareReplay(1));

  // Response helpers
  const respond = interactionRespond<APIInteractionResponseChannelMessageWithSource>(
    rest,
    InteractionResponseType.ChannelMessageWithSource,
  );
  const respondDeferred = interactionRespond<APIInteractionResponseDeferredChannelMessageWithSource>(
    rest,
    InteractionResponseType.DeferredChannelMessageWithSource,
  );

  // Shared command create observable
  const interactionCreate$ = dispatch$(
    GatewayDispatchEvents.InteractionCreate,
  ).pipe(
    RxO.filter((i) => i.type === InteractionType.ApplicationCommand),
    RxO.withLatestFrom(guilds$),
    RxO.map(
      ([interaction, guilds]): SlashCommandContext => ({
        interaction,
        member: (interaction as any).member,
        user: (interaction as any).member,
        guild: guilds.get((interaction as any).guild_id),
        respond: respond(interaction),
        deferred: respondDeferred(interaction),
      }),
    ),
    RxO.share(),
  );

  const globalCommands$ = app$.pipe(
    RxO.flatMap((app) => rest.getApplicationCommands([app.id])),
    RxO.shareReplay(1),
  );

  let globalCommands = Map<string, RESTPostAPIApplicationCommandsJSONBody>();
  const global = (command: RESTPostAPIApplicationCommandsJSONBody) => {
    globalCommands = globalCommands.set(command.name, command);

    return app$.pipe(
      RxO.flatMap((app) => rest.postApplicationCommands([app.id], command)),
      RxO.switchMap(() => interactionCreate$),
      RxO.filter(({ interaction }) => interaction.data.name === command.name),
    );
  };

  let guildCommands = Map<string, GuildCommand>();
  const guild = (command: GuildCommand) => {
    guildCommands = guildCommands.set(command.name, command);

    return interactionCreate$.pipe(
      RxO.filter(({ interaction }) => interaction.data.name === command.name),
    );
  };

  // Remove global commands that do not exist here
  const removeGlobalCommands$ = globalCommands$.pipe(
    RxO.first(),
    RxO.flatMap((commands) => commands),
    RxO.filter((command) => !globalCommands.has(command.name)),
    RxO.withLatestFrom(app$),
    RxO.flatMap(([command, app]) =>
      rest.deleteApplicationCommand([app.id, command.id]),
    ),
    RxO.catchError(() => Rx.EMPTY),
  );

  // Common guild command observables
  const guildCommands$ = Rx.merge(
    dispatch$(GatewayDispatchEvents.GuildCreate),
    dispatch$(GatewayDispatchEvents.GuildUpdate),
  ).pipe(
    RxO.withLatestFrom(app$),
    RxO.flatMap(([guild, app]) =>
      Rx.from(rest.getApplicationGuildCommands([app.id, guild.id])).pipe(
        RxO.catchError(() => Rx.EMPTY),
        RxO.map((commands) => [guild, app, commands] as const),
      ),
    ),
    RxO.share(),
  );

  const guildCommand$ = guildCommands$.pipe(
    RxO.flatMap(([guild, app, commands]) =>
      Rx.from(commands).pipe(
        RxO.map((command) => [guild, app, command] as const),
      ),
    ),
  );

  // Remove guild commands that have not been registered here
  const removeGuildCommands$ = guildCommand$.pipe(
    RxO.filter(([_guild, _app, command]) => !guildCommands.has(command.name)),
    RxO.flatMap(([guild, app, command]) =>
      rest.deleteApplicationGuildCommand([app.id, guild.id, command.id]),
    ),
    RxO.catchError(() => Rx.EMPTY),
  );

  // Remove guild commands that are now disabled
  const guildCommandWithEnabled$ = guildCommand$.pipe(
    RxO.flatMap(([guild, app, command]) =>
      F.pipe(
        isCommandEnabled(guildCommands)(guild, command),
        O.fold(
          () => Rx.EMPTY,
          (isEnabled) =>
            Rx.from(
              isEnabled.then(
                (enabled) => [guild, app, command, enabled] as const,
              ),
            ),
        ),
      ),
    ),
  );

  const disableGuildCommands$ = guildCommandWithEnabled$.pipe(
    RxO.filter(([_guild, _app, _command, enabled]) => !enabled),
    RxO.flatMap(([guild, app, command]) =>
      rest.deleteApplicationGuildCommand([app.id, guild.id, command.id]),
    ),
    RxO.catchError(() => Rx.EMPTY),
  );

  // Add guild commands that have been enabled
  const enableGuildCommands$ = guildCommands$.pipe(
    // Get the commands that are currently disabled
    RxO.flatMap(([guild, app, commands]) =>
      guildCommands
        .reduce(
          (currentlyDisabled, command) =>
            commands.find((apiCommand) => apiCommand.name === command.name)
              ? currentlyDisabled
              : [...currentlyDisabled, command],
          [] as GuildCommand[],
        )
        .map((command) => [guild, app, command] as const),
    ),

    // Check if they should be enabled
    RxO.flatMap(([guild, app, command]) =>
      command
        .enabled(guild)
        .then((enabled) => [guild, app, command, enabled] as const),
    ),
    RxO.filter(([_guild, _app, _command, enabled]) => enabled),

    // Enable the command
    RxO.flatMap(([guild, app, command]) =>
      rest.postApplicationGuildCommands([app.id, guild.id], command),
    ),
  );

  // Respond to pings
  const pingPong$ = dispatch$(GatewayDispatchEvents.InteractionCreate).pipe(
    RxO.filter((i) => i.type === InteractionType.Ping),
    RxO.flatMap((ping) =>
      rest.postInteractionCallback([ping.id, ping.token], {
        type: InteractionResponseType.Pong,
      }),
    ),
  );

  function start() {
    const pingPongSub = pingPong$.subscribe();
    const removeGlobalCommandsSub = removeGlobalCommands$.subscribe();
    const removeGuildCommandsSub = removeGuildCommands$.subscribe();
    const enableGuildCommandsSub = enableGuildCommands$.subscribe();
    const disableGuildCommandsSub = disableGuildCommands$.subscribe();

    return () => {
      pingPongSub.unsubscribe();
      removeGlobalCommandsSub.unsubscribe();
      removeGuildCommandsSub.unsubscribe();
      enableGuildCommandsSub.unsubscribe();
      disableGuildCommandsSub.unsubscribe();
    };
  }

  return {
    global,
    guild,
    start,
  };
};
