import bcrypt from 'bcryptjs';
import { EmailChangeService } from './email-change.service';

/**
 * Self-service email change (#057).
 *
 * The account is addressed by **id**, never by the old email, which is what makes
 * the address safe to change at all. And the new address must be proved before
 * the switch: signing in is email + one-time code, so moving an account to a
 * mistyped address would lock the customer out of their own eSIMs with no way
 * back. These tests pin the parts of that where a mistake is silent.
 */

interface StoredRequest {
  id: number;
  userId: number;
  newEmail: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}

function makeService(
  opts: {
    user?: { id: number; email: string | null };
    otherUserWithEmail?: { id: number; email: string } | null;
    pending?: Partial<StoredRequest> | null;
  } = {},
) {
  const user = opts.user ?? { id: 7, email: 'old@esim.vn' };
  let stored: StoredRequest | null = opts.pending
    ? {
        id: 1,
        userId: user.id,
        newEmail: 'new@esim.vn',
        codeHash: 'unset',
        expiresAt: new Date(Date.now() + 60_000),
        attempts: 0,
        createdAt: new Date(),
        ...opts.pending,
      }
    : null;

  const mails: { to: string; otp: string }[] = [];
  const updates: { id: unknown; payload: Record<string, unknown> }[] = [];

  const requestRepository = {
    findOne: jest.fn(() => Promise.resolve(stored)),
    create: jest.fn((data: StoredRequest) => data),
    save: jest.fn((data: Partial<StoredRequest>) => {
      stored = {
        id: 1,
        userId: user.id,
        newEmail: '',
        codeHash: '',
        expiresAt: new Date(),
        attempts: 0,
        createdAt: new Date(),
        ...data,
      };
      return Promise.resolve(stored);
    }),
    delete: jest.fn(() => {
      stored = null;
      return Promise.resolve({ affected: 1 });
    }),
    increment: jest.fn(() => {
      if (stored) stored.attempts += 1;
      return Promise.resolve({ affected: 1 });
    }),
  };

  const usersService = {
    findById: jest.fn(() => Promise.resolve(user)),
    findByEmail: jest.fn((email: string) =>
      Promise.resolve(
        opts.otherUserWithEmail && opts.otherUserWithEmail.email === email
          ? opts.otherUserWithEmail
          : null,
      ),
    ),
    update: jest.fn((id: unknown, payload: Record<string, unknown>) => {
      updates.push({ id, payload });
      return Promise.resolve({ ...user, ...payload });
    }),
  };

  const mailService = {
    sendOtp: jest.fn((data: { to: string; data: { otp: string } }) => {
      mails.push({ to: data.to, otp: data.data.otp });
      return Promise.resolve();
    }),
  };

  const service = new EmailChangeService(
    requestRepository as never,
    usersService as never,
    mailService as never,
  );

  return {
    service,
    mails,
    updates,
    usersService,
    requestRepository,
    current: () => stored,
  };
}

describe('Requesting an email change', () => {
  it('should mail the code to the NEW address, not the current one', async () => {
    const { service, mails, current } = makeService();

    await service.requestChange(7, 'New@Esim.vn');

    expect(mails).toHaveLength(1);
    // Receiving it at the new address IS the proof of ownership.
    expect(mails[0].to).toBe('new@esim.vn');
    expect(mails[0].otp).toMatch(/^\d{6}$/);
    // Never stored in the clear.
    expect(current()!.codeHash).not.toBe(mails[0].otp);
    await expect(
      bcrypt.compare(mails[0].otp, current()!.codeHash),
    ).resolves.toBe(true);
  });

  it('should not change anything yet', async () => {
    const { service, updates } = makeService();

    await service.requestChange(7, 'new@esim.vn');

    expect(updates).toHaveLength(0);
  });

  it('should refuse an address another account already uses', async () => {
    const { service, mails } = makeService({
      otherUserWithEmail: { id: 99, email: 'taken@esim.vn' },
    });

    await expect(service.requestChange(7, 'taken@esim.vn')).rejects.toThrow();
    expect(mails).toHaveLength(0);
  });

  it('should refuse the address the customer already has', async () => {
    const { service } = makeService();

    // Case and padding must not sneak past the check.
    await expect(service.requestChange(7, ' OLD@esim.vn ')).rejects.toThrow();
  });

  it('should not let the endpoint spam an inbox', async () => {
    const { service, mails } = makeService({
      pending: { createdAt: new Date() },
    });

    await expect(service.requestChange(7, 'new@esim.vn')).rejects.toThrow();
    expect(mails).toHaveLength(0);
  });

  it('should replace a stale request rather than keep two', async () => {
    const { service, mails, current } = makeService({
      pending: {
        newEmail: 'first@esim.vn',
        createdAt: new Date(Date.now() - 5 * 60_000),
      },
    });

    await service.requestChange(7, 'second@esim.vn');

    expect(mails[0].to).toBe('second@esim.vn');
    expect(current()!.newEmail).toBe('second@esim.vn');
  });
});

describe('Confirming an email change', () => {
  async function pendingFor(
    code: string,
    overrides: Partial<StoredRequest> = {},
  ) {
    return makeService({
      pending: {
        newEmail: 'new@esim.vn',
        codeHash: await bcrypt.hash(code, 10),
        ...overrides,
      },
    });
  }

  it('should move the account to the new address, keyed by id', async () => {
    const { service, updates } = await pendingFor('123456');

    await service.confirmChange(7, 'new@esim.vn', '123456');

    expect(updates).toEqual([{ id: 7, payload: { email: 'new@esim.vn' } }]);
  });

  it('should clear the request so a code cannot be replayed', async () => {
    const { service, current } = await pendingFor('123456');

    await service.confirmChange(7, 'new@esim.vn', '123456');

    expect(current()).toBeNull();
  });

  it('should reject a wrong code and count the attempt', async () => {
    const { service, updates, current } = await pendingFor('123456');

    await expect(
      service.confirmChange(7, 'new@esim.vn', '000000'),
    ).rejects.toThrow();
    expect(updates).toHaveLength(0);
    expect(current()!.attempts).toBe(1);
  });

  it('should refuse a code redeemed against a different address', async () => {
    // The code is bound to the address it was mailed to, so it cannot be used to
    // move the account somewhere else.
    const { service, updates } = await pendingFor('123456');

    await expect(
      service.confirmChange(7, 'attacker@esim.vn', '123456'),
    ).rejects.toThrow();
    expect(updates).toHaveLength(0);
  });

  it('should refuse an expired code and drop the request', async () => {
    const { service, updates, current } = await pendingFor('123456', {
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      service.confirmChange(7, 'new@esim.vn', '123456'),
    ).rejects.toThrow();
    expect(updates).toHaveLength(0);
    expect(current()).toBeNull();
  });

  it('should stop after too many wrong attempts', async () => {
    const { service, current } = await pendingFor('123456', { attempts: 5 });

    await expect(
      service.confirmChange(7, 'new@esim.vn', '123456'),
    ).rejects.toThrow();
    expect(current()).toBeNull();
  });

  it('should refuse when someone claimed the address while it was pending', async () => {
    const base = await pendingFor('123456');
    base.usersService.findByEmail.mockResolvedValue({
      id: 99,
      email: 'new@esim.vn',
    } as never);

    await expect(
      base.service.confirmChange(7, 'new@esim.vn', '123456'),
    ).rejects.toThrow();
    expect(base.updates).toHaveLength(0);
  });

  it('should say there is nothing pending rather than fail obscurely', async () => {
    const { service } = makeService();

    await expect(
      service.confirmChange(7, 'new@esim.vn', '123456'),
    ).rejects.toThrow();
  });
});

describe('Pending email lookup', () => {
  it('should report the address awaiting confirmation', async () => {
    const { service } = makeService({ pending: { newEmail: 'new@esim.vn' } });

    await expect(service.pendingEmail(7)).resolves.toBe('new@esim.vn');
  });

  it('should report nothing for an expired or absent request', async () => {
    await expect(makeService().service.pendingEmail(7)).resolves.toBeNull();
    await expect(
      makeService({
        pending: { expiresAt: new Date(Date.now() - 1000) },
      }).service.pendingEmail(7),
    ).resolves.toBeNull();
  });
});
