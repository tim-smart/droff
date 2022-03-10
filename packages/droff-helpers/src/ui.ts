import {
  ActionRow,
  Button,
  ButtonStyle,
  Component,
  ComponentType,
  SelectMenu,
  TextInput,
  TextInputStyle,
} from "droff/types";

export type UIComponent = Exclude<Component, ActionRow>;

/**
 * Helper to create an Action Row grid.
 */
export const grid = (items: UIComponent[][]): ActionRow[] =>
  items.map(
    (components): ActionRow => ({
      type: ComponentType.ACTION_ROW,
      components,
    }),
  );

/**
 * Helper to create a single column of components
 */
export const singleColumn = (items: UIComponent[]): ActionRow[] =>
  items.map((c) => ({
    type: ComponentType.ACTION_ROW,
    components: [c],
  }));

/**
 * Helper to create a button component.
 */
export const button = (button: Partial<Button>): Button => ({
  type: ComponentType.BUTTON,
  style: ButtonStyle.PRIMARY,
  ...button,
});

/**
 * Helper to create a select component.
 */
export const select = (select: Omit<SelectMenu, "type">): SelectMenu => ({
  type: ComponentType.SELECT_MENU,
  ...select,
});

type TextInputOpts = Omit<TextInput, "type" | "style"> & {
  style?: TextInputStyle;
};

/**
 * Helper to create a text input
 */
export const textInput = (input: TextInputOpts): TextInput => ({
  type: ComponentType.TEXT_INPUT,
  style: TextInputStyle.SHORT,
  ...input,
});
