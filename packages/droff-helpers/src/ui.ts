import { ButtonStyle, Component, ComponentType } from "droff/dist/types";

/**
 * Helper to create an Action Row grid.
 */
export const grid = (items: Component[][]): Component[] =>
  items.map(
    (components): Component => ({
      type: ComponentType.ACTION_ROW,
      components,
    }),
  );

/**
 * Helper to create a button component.
 */
export const button = (
  button: Omit<Component, "type" | "components">,
): Component => ({
  type: ComponentType.BUTTON,
  style: ButtonStyle.PRIMARY,
  ...button,
});
