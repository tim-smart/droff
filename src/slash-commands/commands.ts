import {
  APIApplicationCommand,
  APIApplicationCommandInteraction,
  APIGuild,
  InteractionResponseType,
} from "discord-api-types/v8";
import * as F from "fp-ts/function";
import * as O from "fp-ts/Option";
import { Map } from "immutable";
import { Routes } from "../rest/client";
import { GlobalCommand, GuildCommand } from "./factory";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";

export const enabled =
  (commands: Map<string, GuildCommand>) =>
  (guild: APIGuild, apiCommand: APIApplicationCommand) =>
    F.pipe(
      O.fromNullable(commands.get(apiCommand.name)),
      O.map((opts) => Rx.from(opts.enabled(guild))),
      O.map((ob) => Rx.lastValueFrom(ob)),
    );

export const respond =
  <D extends { data?: any }>(rest: Routes, type: InteractionResponseType) =>
  (interaction: APIApplicationCommandInteraction) =>
  (data: D["data"]) =>
    rest.postInteractionCallback([interaction.id, interaction.token], {
      type,
      data,
    });

export const setPermissions =
  (rest: Routes) =>
  (
    guild: APIGuild,
    command: GlobalCommand,
    apiCommand: APIApplicationCommand,
  ) =>
    F.pipe(
      O.fromNullable(command.permissions),
      O.fold(
        () => Promise.resolve(apiCommand),
        (permissions) =>
          F.pipe(
            Rx.from(permissions(guild)),
            RxO.first(),
            RxO.flatMap((permissions) =>
              rest.putApplicationCommandPermissions(
                [apiCommand.application_id, guild.id, apiCommand.id],
                { permissions },
              ),
            ),
            RxO.map(() => apiCommand),
            Rx.lastValueFrom,
          ),
      ),
    );

export type SetPermissionsFn = ReturnType<typeof setPermissions>;
