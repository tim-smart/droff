import { Client } from "droff";
import {
  ApplicationCommand,
  Guild,
  Interaction,
  InteractionApplicationCommandCallbackDatum,
  InteractionCallbackType,
} from "droff/dist/types";
import * as F from "fp-ts/function";
import * as O from "fp-ts/Option";
import { Map } from "immutable";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { GlobalCommand, GuildCommand } from "./factory";

export const enabled =
  (commands: Map<string, GuildCommand>) =>
  (guild: Guild, apiCommand: ApplicationCommand) =>
    F.pipe(
      O.fromNullable(commands.get(apiCommand.name)),
      O.map((opts) => Rx.from(opts.enabled(guild))),
      O.map((ob) => Rx.lastValueFrom(ob)),
    );

export const respond =
  (rest: Client, type: InteractionCallbackType) =>
  (interaction: Interaction) =>
  (data?: InteractionApplicationCommandCallbackDatum) =>
    rest.createInteractionResponse(interaction.id, interaction.token, {
      type,
      data,
    });

export const editOriginal =
  (rest: Client) =>
  (interaction: Interaction) =>
  (data?: InteractionApplicationCommandCallbackDatum) =>
    rest.editOriginalInteractionResponse(
      interaction.application_id,
      interaction.token,
      { data },
    );

export const setPermissions =
  (rest: Client) =>
  (guild: Guild, command: GlobalCommand, apiCommand: ApplicationCommand) =>
    F.pipe(
      O.fromNullable(command.permissions),
      O.fold(
        () => Promise.resolve(apiCommand),
        (permissions) =>
          F.pipe(
            permissions(guild),
            RxO.toArray(),
            RxO.flatMap((permissions) =>
              rest.editApplicationCommandPermissions(
                apiCommand.application_id,
                guild.id,
                apiCommand.id,
                { permissions },
              ),
            ),
            RxO.map(() => apiCommand),
            Rx.lastValueFrom,
          ),
      ),
    );

export type SetPermissionsFn = ReturnType<typeof setPermissions>;
