import { Client } from "droff";
import { Application, Guild } from "droff/types";
import { Map } from "immutable";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { GlobalCommand, GuildCommand } from "./factory";

export const global =
  (client: Client, application$: Rx.Observable<Application>) =>
  (globalCommands: () => Map<string, GlobalCommand>) =>
    application$.pipe(
      RxO.first(),
      RxO.flatMap((app) =>
        client.bulkOverwriteGlobalApplicationCommands(app.id, {
          data: [...globalCommands().values()],
        }),
      ),
    );

export const guild =
  (client: Client, application$: Rx.Observable<Application>) =>
  (guildCommands: () => Map<string, GuildCommand>) => {
    if (guildCommands().size === 0) {
      return Rx.EMPTY;
    }

    const updateGuild$ = (guild: Guild) =>
      Rx.from(guildCommands().values()).pipe(
        RxO.flatMap((command) =>
          Rx.zip(Rx.of(command), Rx.from(command.enabled(guild))),
        ),
        RxO.filter(([, enabled]) => enabled),
        RxO.map(([command]) => command),
        RxO.toArray(),
        RxO.withLatestFrom(application$),
        RxO.flatMap(([commands, app]) =>
          client.bulkOverwriteGuildApplicationCommands(
            app.id,
            guild.id,
            commands as any,
          ),
        ),
      );

    return Rx.merge(
      client.fromDispatch("GUILD_CREATE"),
      client.fromDispatch("GUILD_UPDATE"),
    ).pipe(
      RxO.groupBy((g) => g.id, {
        duration: ($) => $.pipe(RxO.debounceTime(30000)),
      }),
      RxO.flatMap((guild$) => guild$.pipe(RxO.switchMap(updateGuild$))),
      RxO.share(),
    );
  };
