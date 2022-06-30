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
import { GuildCommand } from "./factory";

export const enabled =
  (commands: Map<string, GuildCommand>) =>
  (guild: Guild, apiCommand: ApplicationCommand) =>
    F.pipe(
      O.fromNullable(commands.get(apiCommand.name)),
      O.map((opts) => Rx.from(opts.enabled(guild))),
      O.map((ob) => Rx.lastValueFrom(ob)),
    );

export interface RespondFn {
  (type: InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE): (
    data: InteractionCallbackMessage,
  ) => Promise<any>;
  (type: InteractionCallbackType.UPDATE_MESSAGE): (
    data: InteractionCallbackMessage,
  ) => Promise<any>;
  (type: InteractionCallbackType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT): (
    data: InteractionCallbackAutocomplete,
  ) => Promise<any>;
  (type: InteractionCallbackType.MODAL): (
    data: InteractionCallbackModal,
  ) => Promise<any>;
  (type: InteractionCallbackType): (
    data?: InteractionCallbackDatum,
  ) => Promise<any>;
}

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
