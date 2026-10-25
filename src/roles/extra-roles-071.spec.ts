import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { RolesGuard } from './roles.guard';
import { RoleEnum } from './roles.enum';
import { allRoleIds, cleanExtraRoleIds } from './extra-roles';

/**
 * Several roles for one user (vande #071): an admin who also writes articles,
 * an author who also buys on the storefront to test it.
 */

function contextFor(user: unknown, roles: number[]) {
  const reflector = {
    getAllAndOverride: () => roles,
  } as unknown as Reflector;
  const context = {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return { reflector, context };
}

function guardWith(saved: number[] | null, user: unknown, roles: number[]) {
  const query = jest
    .fn()
    .mockResolvedValue(saved === null ? [] : [{ extraRoleIds: saved }]);
  const { reflector, context } = contextFor(user, roles);
  const guard = new RolesGuard(reflector, { query } as unknown as DataSource);
  return { run: () => guard.canActivate(context), query };
}

describe('RolesGuard with extra roles (vande #071)', () => {
  it('should let the main role through without asking the database', async () => {
    const { run, query } = guardWith([], { id: 7, role: { id: 1 } }, [
      RoleEnum.admin,
    ]);

    await expect(run()).resolves.toBe(true);
    expect(query).not.toHaveBeenCalled();
  });

  it('should let an author who was also given "Người dùng" buy', async () => {
    const { run } = guardWith(
      [RoleEnum.user],
      { id: 9, role: { id: RoleEnum.author } },
      [RoleEnum.user, RoleEnum.admin],
    );

    await expect(run()).resolves.toBe(true);
  });

  it('should go by the saved roles, not a stale token', async () => {
    // The token still says author; the admin has since taken it away.
    const { run, query } = guardWith(
      [],
      { id: 9, role: { id: RoleEnum.user }, extraRoleIds: [RoleEnum.author] },
      [RoleEnum.admin, RoleEnum.author],
    );

    await expect(run()).resolves.toBe(false);
    expect(query.mock.calls[0][1]).toEqual([9]);
  });

  it('should refuse a role nobody gave', async () => {
    const { run } = guardWith(
      [RoleEnum.author],
      { id: 9, role: { id: RoleEnum.user } },
      [RoleEnum.admin],
    );

    await expect(run()).resolves.toBe(false);
  });

  it('should refuse a deleted account', async () => {
    const { run } = guardWith(null, { id: 9, role: { id: 2 } }, [3]);

    await expect(run()).resolves.toBe(false);
  });
});

describe('cleanExtraRoleIds (vande #071)', () => {
  it('should keep only user and author, never admin or partner', () => {
    expect(cleanExtraRoleIds([1, 2, 3, 4], RoleEnum.admin)).toEqual([2, 3]);
  });

  it('should drop the main role and repeats', () => {
    expect(cleanExtraRoleIds(['3', 3, 2], RoleEnum.author)).toEqual([2]);
    expect(cleanExtraRoleIds(undefined, RoleEnum.user)).toEqual([]);
  });

  it('should list every role a user holds, main first', () => {
    expect(allRoleIds({ role: { id: 1 }, extraRoleIds: [3] })).toEqual([1, 3]);
    expect(allRoleIds({ role: { id: '2' } })).toEqual([2]);
  });
});
