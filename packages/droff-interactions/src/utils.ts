import {
  ApplicationCommandType,
  Interaction,
  Message,
  User,
} from "droff/dist/types";
import * as O from "fp-ts/lib/Option";

export const targetMessage = (interaction: Interaction): O.Option<Message> =>
  O.fromNullable(
    interaction.data?.resolved?.messages?.[interaction.data?.target_id as any],
  );

export const targetUser = (interaction: Interaction): O.Option<User> =>
  O.fromNullable(
    interaction.data?.resolved?.users?.[interaction.data?.target_id as any],
  );
