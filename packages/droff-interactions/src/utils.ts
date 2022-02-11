import { Interaction, Message, User } from "droff/dist/types";
import * as Arr from "fp-ts/lib/Array";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";

export const targetMessage = (interaction: Interaction): O.Option<Message> =>
  O.fromNullable(
    interaction.data?.resolved?.messages?.[interaction.data?.target_id as any],
  );

export const targetUser = (interaction: Interaction): O.Option<User> =>
  O.fromNullable(
    interaction.data?.resolved?.users?.[interaction.data?.target_id as any],
  );

export const focusedOption = (interaction: Interaction) =>
  pipe(
    O.fromNullable(interaction.data?.options),
    O.chain(Arr.findFirst(({ focused }) => focused === true)),
  );
