import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

/**
 * Changing your own login password (#066).
 *
 * The dashboard now has a screen for this, which makes these rules reachable by
 * every admin rather than by nobody: the current password must be proved, and a
 * successful change must sign every OTHER session out — that is the whole point
 * of rotating a password you think has leaked.
 */

const CURRENT = 'current-pass';
const SESSION_ID = 42;

async function makeService(opts: { hasPassword?: boolean } = {}) {
  const service = Object.create(AuthService.prototype) as AuthService;
  const internals = service as unknown as Record<string, unknown>;

  const user = {
    id: 7,
    email: 'admin@esim.vn',
    password:
      opts.hasPassword === false ? null : await bcrypt.hash(CURRENT, 10),
  };

  const updates: { id: unknown; payload: Record<string, unknown> }[] = [];
  const deletedSessions: Record<string, unknown>[] = [];

  internals.usersService = {
    findById: jest.fn().mockResolvedValue(user),
    findByEmail: jest.fn().mockResolvedValue(null),
    update: jest.fn((id: unknown, payload: Record<string, unknown>) => {
      updates.push({ id, payload });
      return Promise.resolve({ ...user, ...payload });
    }),
  };
  internals.sessionService = {
    deleteByUserIdWithExclude: jest.fn((args: Record<string, unknown>) => {
      deletedSessions.push(args);
      return Promise.resolve();
    }),
  };

  const change = (dto: Record<string, unknown>) =>
    service.update({ id: 7, sessionId: SESSION_ID } as never, dto as never);

  return { change, updates, deletedSessions };
}

describe('Changing your own password', () => {
  it('should save the new password when the current one is right', async () => {
    const { change, updates } = await makeService();

    await change({ oldPassword: CURRENT, password: 'brand-new-pass' });

    expect(updates).toHaveLength(1);
    expect(updates[0].payload.password).toBe('brand-new-pass');
  });

  it('should sign every other session out', async () => {
    const { change, deletedSessions } = await makeService();

    await change({ oldPassword: CURRENT, password: 'brand-new-pass' });

    // Rotating a leaked password is pointless if the other party stays signed in.
    expect(deletedSessions).toEqual([
      { userId: 7, excludeSessionId: SESSION_ID },
    ]);
  });

  it('should refuse a wrong current password', async () => {
    const { change, updates, deletedSessions } = await makeService();

    await expect(
      change({ oldPassword: 'not-my-password', password: 'brand-new-pass' }),
    ).rejects.toThrow();
    expect(updates).toHaveLength(0);
    // A failed attempt must not kick the real owner out either.
    expect(deletedSessions).toHaveLength(0);
  });

  it('should refuse to change without the current password at all', async () => {
    const { change, updates } = await makeService();

    await expect(change({ password: 'brand-new-pass' })).rejects.toThrow();
    expect(updates).toHaveLength(0);
  });

  it('should refuse when the account has no password to compare against', async () => {
    // Social/OTP-only accounts: there is nothing to verify, so a password
    // cannot be swapped through this route.
    const { change, updates } = await makeService({ hasPassword: false });

    await expect(
      change({ oldPassword: CURRENT, password: 'brand-new-pass' }),
    ).rejects.toThrow();
    expect(updates).toHaveLength(0);
  });

  it('should leave sessions alone when no password is being changed', async () => {
    const { change, deletedSessions } = await makeService();

    await change({ firstName: 'Quản' });

    expect(deletedSessions).toHaveLength(0);
  });
});
