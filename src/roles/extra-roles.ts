import { RoleEnum } from './roles.enum';

/**
 * Roles an admin may tick on top of a user's main role (vande #071): an admin
 * who also writes articles ("Tác giả"), an admin or author who buys on the
 * storefront to test it ("Người dùng"). Admin is only ever a main role — it
 * is the one that opens everything — and a partner account is its own kind.
 */
export const EXTRA_ROLE_IDS: readonly number[] = [
  RoleEnum.user,
  RoleEnum.author,
];

/** The extra roles worth keeping: allowed, not the main role, no repeats. */
export function cleanExtraRoleIds(
  ids: readonly (number | string)[] | null | undefined,
  mainRoleId: number | string | null | undefined,
): number[] {
  const main = Number(mainRoleId);
  return [...new Set((ids ?? []).map(Number))]
    .filter((id) => EXTRA_ROLE_IDS.includes(id) && id !== main)
    .sort((a, b) => a - b);
}

/** Every role a user holds: the main one first, then the extra ones. */
export function allRoleIds(user: {
  role?: { id?: number | string } | null;
  extraRoleIds?: readonly (number | string)[] | null;
}): number[] {
  const main = Number(user.role?.id);
  const extra = (user.extraRoleIds ?? []).map(Number);
  return [...new Set([...(Number.isFinite(main) ? [main] : []), ...extra])];
}
