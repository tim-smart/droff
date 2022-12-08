import { GatewayIntents } from "droff/types";
import * as Flags from "./flags";

/**
 * All the intents
 */
export const ALL = Flags.all(GatewayIntents);

/**
 * Privileged intents
 */
export const PRIVILEGED =
  GatewayIntents.GUILD_PRESENCES |
  GatewayIntents.GUILD_MEMBERS |
  GatewayIntents.MESSAGE_CONTENT;

/**
 * Un-privileged intents
 */
export const UNPRIVILEGED = ALL ^ PRIVILEGED;

/**
 * Function that converts a intents bitfield value to a list of intent names.
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
