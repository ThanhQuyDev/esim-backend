import { UsersService } from './users.service';
import { assertAccountNotLocked } from '../auth/auth.service';

/** "Khoá tài khoản" (security 15/11/2026). */
function makeService(user: unknown) {
  const update = jest.fn((id, payload) => Promise.resolve({ id, ...payload }));
  const deleteByUserId = jest.fn().mockResolvedValue(undefined);
  const service = new UsersService(
    { findById: jest.fn().mockResolvedValue(user), update } as never,
    {} as never,
    {} as never,
    { deleteByUserId } as never,
  );
  return { service, update, deleteByUserId };
}

describe('UsersService.lock', () => {
  it('should lock a customer and sign them out everywhere', async () => {
    const { service, update, deleteByUserId } = makeService({
      id: 349,
      role: { id: 2 },
    });
    const locked = await service.lock(349, '  Lấy eSIM không trả tiền ', 1);
    expect(update).toHaveBeenCalledWith(
      349,
      expect.objectContaining({ lockReason: 'Lấy eSIM không trả tiền' }),
    );
    expect(locked?.lockedAt).toBeInstanceOf(Date);
    expect(deleteByUserId).toHaveBeenCalledWith({ userId: 349 });
  });

  it('should not lock an admin, or the admin doing it', async () => {
    await expect(
      makeService({ id: 2, role: { id: 1 } }).service.lock(2, 'x x x', 1),
    ).rejects.toThrow();
    await expect(
      makeService({ id: 5, role: { id: 3 } }).service.lock(5, 'x x x', 5),
    ).rejects.toThrow();
  });

  it('should unlock', async () => {
    const { service, update } = makeService({ id: 349 });
    await service.unlock(349);
    expect(update).toHaveBeenCalledWith(349, {
      lockedAt: null,
      lockReason: null,
    });
  });
});

describe('assertAccountNotLocked', () => {
  it('should refuse sign-in to a locked account and say why', () => {
    expect(() => assertAccountNotLocked({ lockedAt: new Date() })).toThrow();
    expect(() => assertAccountNotLocked({ lockedAt: null })).not.toThrow();
  });
});
