import * as F from "fp-ts/function";
import * as O from "fp-ts/Option";
import { Map } from "immutable";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { Dispatch } from "../gateway/dispatch";
import { Routes } from "../rest/client";
import { Application } from "../types";
import * as Commands from "./commands";
import { GlobalCommand, GuildCommand } from "./factory";

export const global =
  (rest: Routes, app$: Rx.Observable<Pick<Application, "id">>) =>
  (globalCommands: () => Map<string, GlobalCommand>) => {
    const globalCommands$ = app$.pipe(
      RxO.flatMap((app) => rest.getGlobalApplicationCommands(app.id)),
      RxO.shareReplay(1),
    );

    // Remove global commands that do not exist here
    const removeGlobalCommands$ = globalCommands$.pipe(
      RxO.first(),
      RxO.flatMap((commands) => commands),
      RxO.filter((command) => !globalCommands().has(command.name)),
      RxO.withLatestFrom(app$),
      RxO.flatMap(([command, app]) =>
        rest.deleteGlobalApplicationCommand(app.id, command.id),
      ),
      RxO.catchError(() => Rx.EMPTY),
    );

    return {
      removeGlobalCommands$,
    };
  };

export const guild =
  (
    dispatch$: Dispatch,
    rest: Routes,
    app$: Rx.Observable<Pick<Application, "id">>,
    setPermissions: Commands.SetPermissionsFn,
  ) =>
  (guildCommands: () => Map<string, GuildCommand>) => {
    // Common guild command observables
    const guildCommands$ = Rx.merge(
      dispatch$("GUILD_CREATE"),
      dispatch$("GUILD_UPDATE"),
    ).pipe(
      RxO.withLatestFrom(app$),
      RxO.flatMap(([guild, app]) =>
        Rx.from(rest.getGuildApplicationCommands(app.id, guild.id)).pipe(
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
      RxO.filter(
        ([_guild, _app, command]) => !guildCommands().has(command.name),
      ),
      RxO.flatMap(([guild, app, command]) =>
        rest.deleteGuildApplicationCommand(app.id, guild.id, command.id),
      ),
      RxO.catchError(() => Rx.EMPTY),
    );

    // Remove guild commands that are now disabled
    const guildCommandWithEnabled$ = guildCommand$.pipe(
      RxO.flatMap(([guild, app, command]) =>
        F.pipe(
          Commands.enabled(guildCommands())(guild, command),
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
        rest.deleteGuildApplicationCommand(app.id, guild.id, command.id),
      ),
      RxO.catchError(() => Rx.EMPTY),
    );

    // Add guild commands that have been enabled
    const enableGuildCommands$ = guildCommands$.pipe(
      RxO.flatMap(([guild, app]) =>
        Rx.from(guildCommands().values()).pipe(
          RxO.map((command) => [guild, app, command] as const),
        ),
      ),

      // Check if they should be enabled
      RxO.flatMap(([guild, app, command]) =>
        Rx.zip(
          Rx.of(guild),
          Rx.of(app),
          Rx.of(command),
          command.enabled(guild),
        ),
      ),
      RxO.filter(([_guild, _app, _command, enabled]) => enabled),

      // Enable the command
      RxO.flatMap(([guild, app, command]) =>
        rest
          .createGuildApplicationCommand(app.id, guild.id, command)
          // Set permissions
          .then((apiCommand) => setPermissions(guild, command, apiCommand)),
      ),
    );

    return {
      removeGuildCommands$,
      enableGuildCommands$,
      disableGuildCommands$,
    };
  };
