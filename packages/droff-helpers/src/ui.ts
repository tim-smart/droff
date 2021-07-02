import {
  ActionRow,
  Button,
  ButtonStyle,
  Component,
  ComponentType,
  SelectMenu,
} from "droff/dist/types";

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
export const select = (select: SelectMenu): SelectMenu => select;
