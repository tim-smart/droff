import { Interactions as H } from "droff-helpers";
import { Interaction, Message, User } from "droff/types";
import * as Arr from "fp-ts/lib/Array";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";

export const targetMessage = (interaction: Interaction): O.Option<Message> =>
  pipe(
    H.getCommandOrAutocompleteData(interaction),
    O.chainNullableK((d) => d.resolved?.messages?.[d.target_id as any]),
  );

export const targetUser = (interaction: Interaction): O.Option<User> =>
  pipe(
    H.getCommandOrAutocompleteData(interaction),
    O.chainNullableK((d) => d.resolved?.users?.[d.target_id as any]),
  );

export const focusedOption = (interaction: Interaction) =>
  pipe(
    H.optionsWithNested(interaction),
    Arr.findFirst(({ focused }) => focused === true),
  );

export const memoize = <A, T>(fn: (arg: A) => T) => {
  const cache = new Map<A, T>();

  return (arg: A) => {
    const val = cache.get(arg);
    if (val) return val;

    const newVal = fn(arg);
    cache.set(arg, newVal);
    return newVal;
  };
};
