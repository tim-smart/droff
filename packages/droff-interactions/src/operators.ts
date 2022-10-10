import {
  ActionRow,
  ApplicationCommandInteractionDataOption,
  Component,
} from "droff/types";
import { pipe } from "fp-ts/lib/function";
import { Map } from "immutable";
import { Observable } from "rxjs";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";
import { InteractionContext } from "./factory";
import * as O from "fp-ts/lib/Option";
import { Interactions as H } from "droff-helpers";

export const filterByName = (name: string) =>
  RxO.filter(({ interaction }: InteractionContext) =>
    pipe(
      H.getCommandOrAutocompleteData(interaction),
      O.filter((d) => d.name === name),
      O.isSome,
    ),
  );

export type InteractionContextWithSubCommand = readonly [
  InteractionContext,
  ApplicationCommandInteractionDataOption,
];

export const withSubCommand = (name: string) => {
  const find = H.findSubCommand(name);
  return RxO.flatMap((ctx: InteractionContext) =>
    pipe(
      find(ctx.interaction),
      O.fold(
        () => Rx.EMPTY,
        (subCommand) =>
          Rx.of([ctx, subCommand] as InteractionContextWithSubCommand),
      ),
    ),
  );
};

export const filterBySelector =
  (selector: (data: InteractionContext) => string | undefined) =>
  (matcher: string | RegExp) =>
    matcher instanceof RegExp
      ? RxO.filter((ctx: InteractionContext) =>
          matcher.test(selector(ctx) ?? ""),
        )
      : RxO.filter((ctx: InteractionContext) => selector(ctx) === matcher);

export const selectorStartsWith =
  (selector: (data: InteractionContext) => string | undefined) =>
  (prefix: string) =>
    RxO.filter((ctx: InteractionContext) =>
      (selector(ctx) ?? "").startsWith(prefix),
    );

export const filterByCustomId = filterBySelector(
  ({ interaction }) => (interaction.data as any)?.custom_id,
);

export const customIdStartsWith = selectorStartsWith(
  ({ interaction }) => (interaction.data as any)?.custom_id,
);

export const filterByFocusedOption = filterBySelector(
  ({ focusedOption }) => focusedOption?.name,
);

export const focusedOptionStartsWith = selectorStartsWith(
  ({ focusedOption }) => focusedOption?.name,
);

export const filterByComponents =
  (components: Exclude<Component, ActionRow>[]) =>
  (source$: Observable<InteractionContext>) => {
    const map = components
      .filter(({ custom_id }) => !!custom_id)
      .reduce((map, c) => map.set(c.custom_id!, c), Map<string, Component>());

    return source$.pipe(
      RxO.filter(({ interaction }) =>
        map.has((interaction.data as any).custom_id || ""),
      ),
      RxO.map(
        (ctx) =>
          [
            ctx,
            map.get((ctx.interaction.data as any).custom_id || "")!,
          ] as const,
      ),
    );
  };
