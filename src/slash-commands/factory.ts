import {
  APIApplicationCommandInteraction,
  APIApplicationCommandPermission,
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
import { Map } from "immutable";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import * as App from "../gateway-utils/applications";
import { Dispatch } from "../gateway/dispatch";
import { Routes } from "../rest/client";
import * as Commands from "./commands";
import * as Sync from "./sync";

interface CommandOptions {
  permissions?: (guild: APIGuild) => Promise<APIApplicationCommandPermission[]>;
}

interface GuildCommandOptions {
  enabled?: (guild: APIGuild) => Promise<boolean>;
}

export type GlobalCommand = RESTPostAPIApplicationCommandsJSONBody &
  CommandOptions;

export type GuildCommand = RESTPostAPIApplicationCommandsJSONBody &
  Required<GuildCommandOptions> &
  CommandOptions;

export type GuildCommandCreate = RESTPostAPIApplicationCommandsJSONBody &
  GuildCommandOptions &
  CommandOptions;

export interface SlashCommandContext {
  interaction: APIApplicationCommandInteraction;
  member?: APIInteractionGuildMember;
  user?: APIUser;

  respond: (
    data: APIInteractionResponseChannelMessageWithSource["data"],
  ) => Promise<never>;
  deferred: (
    data: APIInteractionResponseDeferredChannelMessageWithSource["data"],
  ) => Promise<never>;
}

export const factory =
  (
    dispatch$: Dispatch,
    rest: Routes,
    guilds$: Rx.Observable<Map<Snowflake, APIGuild>>,
  ) =>
  () => {
    const app$ = App.watch$(dispatch$).pipe(RxO.first(), RxO.shareReplay(1));

    // Response helpers
    const respond =
      Commands.respond<APIInteractionResponseChannelMessageWithSource>(
        rest,
        InteractionResponseType.ChannelMessageWithSource,
      );
    const respondDeferred =
      Commands.respond<APIInteractionResponseDeferredChannelMessageWithSource>(
        rest,
        InteractionResponseType.DeferredChannelMessageWithSource,
      );

    // Set permissions fn
    const setPermissions = Commands.setPermissions(rest);

    // Shared command create observable
    const interactionCreate$ = dispatch$(
      GatewayDispatchEvents.InteractionCreate,
    ).pipe(
      RxO.filter((i) => i.type === InteractionType.ApplicationCommand),
      RxO.map(
        (interaction): SlashCommandContext => ({
          interaction,
          member: (interaction as any).member,
          user: (interaction as any).user,
          respond: respond(interaction),
          deferred: respondDeferred(interaction),
        }),
      ),
      RxO.share(),
    );

    // Command creation functions
    let globalCommands = Map<string, RESTPostAPIApplicationCommandsJSONBody>();
    const global = (command: GlobalCommand) => {
      globalCommands = globalCommands.set(command.name, command);

      return app$.pipe(
        RxO.flatMap((app) => rest.postApplicationCommands([app.id], command)),

        // Update permissions
        RxO.withLatestFrom(guilds$),
        RxO.flatMap(([apiCommand, guilds]) =>
          F.pipe(
            Rx.from(guilds.values()),
            RxO.flatMap((guild) => setPermissions(guild, command, apiCommand)),
            RxO.last(),
          ),
        ),

        // Switch to emitting the interactions
        RxO.switchMap(() => interactionCreate$),
        RxO.filter(({ interaction }) => interaction.data.name === command.name),
      );
    };

    let guildCommands = Map<string, GuildCommand>();
    const guild = (command: GuildCommandCreate) => {
      guildCommands = guildCommands.set(command.name, {
        ...command,
        enabled: command.enabled || (async () => true),
      });

      return interactionCreate$.pipe(
        RxO.filter(({ interaction }) => interaction.data.name === command.name),
      );
    };

    // Respond to pings
    const pingPong$ = dispatch$(GatewayDispatchEvents.InteractionCreate).pipe(
      RxO.filter((i) => i.type === InteractionType.Ping),
      RxO.flatMap((ping) =>
        rest.postInteractionCallback([ping.id, ping.token], {
          type: InteractionResponseType.Pong,
        }),
      ),
    );

    // Sync
    const { removeGlobalCommands$ } = Sync.global(
      rest,
      app$,
    )(() => globalCommands);
    const {
      removeGuildCommands$,
      enableGuildCommands$,
      disableGuildCommands$,
    } = Sync.guild(dispatch$, rest, app$, setPermissions)(() => guildCommands);

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
      /** Create a global slash command */
      global,
      /** Create a guild slash command */
      guild,
      /**
       * Start syncing the commands to Discord. It returns a function that stops
       * the syncing service.
       */
      start,
    };
  };
