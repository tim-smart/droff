import {
  Channel,
  GuildMember,
  Overwrite,
  PermissionFlag,
  Role,
} from "droff/types";
import * as F from "fp-ts/function";
import * as Flags from "./flags";
import * as Members from "./members";

/**
 * A constant of all the permissions
 */
export const ALL = Flags.all(PermissionFlag);

/**
 * Check if a flag exists in the permissions.
 */
export const has = Flags.hasBigInt;

/**
 * Convert a permissions bitfield to a list of flag names.
 */
export const toList = Flags.toList(PermissionFlag);

/**
 * Convert a list of flag names to a bitfield.
 */
export const fromList = Flags.fromListBigint(PermissionFlag);

/**
 * Reduce a list of roles to a bitfield of all the permissions added together.
 */
export const forRoles = (roles: Role[]) =>
  roles.reduce(
    (permissions, role) => permissions | BigInt(role.permissions),
    BigInt(0),
  );

/**
 * From a list of roles, calculate the permissions bitfield for the member.
 */
export const forMember = (roles: Role[]) => (member: GuildMember) =>
  F.pipe(Members.roles(roles)(member), forRoles);

const overwriteIsForMember =
  (guildId?: string) => (member: GuildMember) => (overwrite: Overwrite) => {
    if (overwrite.type === 0) {
      return overwrite.id === guildId || member.roles.includes(overwrite.id);
    }
    return overwrite.id === member.user?.id;
  };

const overwriteIsForRole =
  (guildId?: string) => (role: Role) => (overwrite: Overwrite) => {
    if (overwrite.type === 0) {
      return overwrite.id === guildId || overwrite.id === role.id;
    }

    return false;
  };

/**
 * From a list of roles and a channel, calculate the permission bitfield for
 * the guild member or role for that channel.
 */
export const forChannel =
  (roles: Role[]) =>
  ({ guild_id, permission_overwrites: overwrites = [] }: Channel) =>
  (memberOrRole: GuildMember | Role) => {
    const hasAdmin = has(PermissionFlag.ADMINISTRATOR);
    let basePermissions: bigint;
    let filteredOverwrites: Overwrite[];

    if (Members.is(memberOrRole)) {
      if (memberOrRole.permissions) return BigInt(memberOrRole.permissions);

      const memberRoles = Members.roles(roles)(memberOrRole);
      basePermissions = forRoles(memberRoles);
      filteredOverwrites = overwrites.filter(
        overwriteIsForMember(guild_id)(memberOrRole),
      );
    } else {
      const everyone = roles.find((role) => role.name === "@everyone");
      basePermissions =
        BigInt(everyone?.permissions || "0") | BigInt(memberOrRole.permissions);
      filteredOverwrites = overwrites.filter(
        overwriteIsForRole(guild_id)(memberOrRole),
      );
    }

    if (hasAdmin(basePermissions)) {
      return ALL;
    }
    return applyOverwrites(basePermissions)(filteredOverwrites);
  };

/**
 * Apply permission overwrites to a bitfield.
 */
export const applyOverwrites =
  (permissions: bigint) => (overwrites: Overwrite[]) =>
    overwrites.reduce(
      (permissions, overwrite) =>
        (permissions & ~BigInt(overwrite.deny)) | BigInt(overwrite.allow),
      permissions,
    );
