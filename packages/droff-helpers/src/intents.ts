import { GatewayIntents } from "droff/dist/types";
import * as Flags from "./flags";

/**
 * All the intents
 */
export const ALL = Flags.all(GatewayIntents);

/**
 * Function that converts a intents bitfield value toa list of intent names.
 */
export const toList = Flags.toList(GatewayIntents);

/**
 * Function that converts a list of intent names to a bitfield value.
 */
export const fromList = Flags.fromList(GatewayIntents);

/**
 * Check if an intent flag exists in the permissions.
 */
export const has = Flags.has;
