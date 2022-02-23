import {
  ApplicationCommandInteractionDataOption,
  ApplicationCommandOptionType,
  Component,
  Interaction,
  TextInput,
} from "droff/dist/types";
import * as Arr from "fp-ts/Array";
import * as F from "fp-ts/function";
import * as O from "fp-ts/Option";
import Im from "immutable";

/**
 * Maybe find a sub-command within the interaction options.
 */
export const findSubCommand = (name: string) => (interaction: Interaction) =>
  F.pipe(
    O.fromNullable(interaction.data?.options),
    O.chain(
      Arr.findFirst(
        (o: ApplicationCommandInteractionDataOption) =>
          o.type === ApplicationCommandOptionType.SUB_COMMAND &&
          o.name === name,
      ),
    ),
  );

/**
 * If the sub-command exists return `true`, else `false`.
 */
export const isSubCommand = (name: string) =>
  F.flow(findSubCommand(name), O.isSome);

/**
 * Maybe get the options for a sub-command
 */
export const subCommandOptions = (name: string) =>
  F.flow(
    findSubCommand(name),
    O.chainNullableK((o) => o.options),
  );

/**
 * A lens for accessing the options in a interaction.
 */
export const options = (
  interaction: Interaction,
): ApplicationCommandInteractionDataOption[] =>
  F.pipe(
    O.fromNullable(interaction.data?.options),
    O.getOrElseW(() => []),
  );

/**
 * Return the interaction options as a name / value map.
 */
export const transformOptions = (
  options: ApplicationCommandInteractionDataOption[],
) =>
  options.reduce(
    (map, option) => map.set(option.name, option.value),
    Im.Map<string, string | undefined>(),
  );

/**
 * Return the interaction options as a name / value map.
 */
export const optionsMap = F.flow(options, transformOptions);

/**
 * Try find a matching option from the interaction.
 */
export const getOption = (name: string) =>
  F.flow(
    options,
    Arr.findFirst((o) => o.name === name),
  );

/**
 * Try find a matching option value from the interaction.
 */
export const optionValue = (name: string) =>
  F.flow(
    getOption(name),
    O.chainNullableK((o) => o.value),
  );

const extractComponents = (c: Component): Component[] => {
  if ("components" in c) {
    return [...c.components, ...c.components.flatMap(extractComponents)];
  }

  return [];
};

/**
 * A lens for accessing the components in a interaction.
 */
export const components = (interaction: Interaction): Component[] =>
  F.pipe(
    O.fromNullable(interaction.data?.components),
    O.map((arr) => [...arr, ...arr.flatMap(extractComponents)]),
    O.getOrElseW(() => []),
  );

/**
 * A lens for accessing the components in a interaction.
 */
export const componentsWithValue = F.flow(
  components,
  Arr.filter((c) => "value" in c && c.value !== undefined),
);

/**
 * Return the interaction components as an id / value map.
 */
export const transformComponents = (options: Component[]) =>
  (options as TextInput[]).reduce(
    (map, c) => (c.custom_id ? map.set(c.custom_id, c.value) : map),
    Im.Map<string, string | undefined>(),
  );

/**
 * Return the interaction components as an id / value map.
 */
export const componentsMap = F.flow(components, transformComponents);

/**
 * Try find a matching component from the interaction.
 */
export const getComponent = (id: string) =>
  F.flow(
    components,
    Arr.findFirst((o) => (o as TextInput).custom_id === id),
  );

/**
 * Try find a matching component value from the interaction.
 */
export const componentValue = (id: string) =>
  F.flow(
    getComponent(id),
    O.chainNullableK((o) => (o as TextInput).value),
  );
