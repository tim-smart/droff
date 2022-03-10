import { RESTClient } from "droff";
import {
  ApplicationCommand,
  Guild,
  Interaction,
  InteractionCallbackAutocomplete,
  InteractionCallbackDatum,
  InteractionCallbackMessage,
  InteractionCallbackModal,
  InteractionCallbackType,
} from "droff/types";
import * as F from "fp-ts/function";
import * as O from "fp-ts/Option";
import { Map } from "immutable";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { GuildCommand } from "./factory";

export const enabled =
  (commands: Map<string, GuildCommand>) =>
  (guild: Guild, apiCommand: ApplicationCommand) =>
    F.pipe(
      O.fromNullable(commands.get(apiCommand.name)),
      O.map((opts) => Rx.from(opts.enabled(guild))),
      O.map((ob) => Rx.lastValueFrom(ob)),
    );

export interface ResponseTypes {
  [type: number]: InteractionCallbackDatum | undefined;
  [InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE]: InteractionCallbackMessage;
  [InteractionCallbackType.UPDATE_MESSAGE]: InteractionCallbackMessage;
  [InteractionCallbackType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT]: InteractionCallbackAutocomplete;
  [InteractionCallbackType.MODAL]: InteractionCallbackModal;
}
export type RespondFn = <K extends keyof ResponseTypes>(
  type: K,
) => (data?: ResponseTypes[K]) => Promise<any>;

export const respond =
  (rest: RESTClient) =>
  (interaction: Interaction): RespondFn =>
  (type) =>
  (data) =>
    rest.createInteractionResponse(interaction.id, interaction.token, {
      type,
      data,
    });

export const editOriginal =
  (rest: RESTClient) =>
  (interaction: Interaction) =>
  (data?: InteractionCallbackDatum) =>
    rest.editOriginalInteractionResponse(
      interaction.application_id,
      interaction.token,
      { data },
    );

export const setPermissions =
  (rest: RESTClient) =>
  (guild: Guild, command: GuildCommand, apiCommand: ApplicationCommand) =>
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
