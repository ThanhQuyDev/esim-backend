import bcrypt from 'bcryptjs';
import { EmailChangeService } from './email-change.service';

/**
 * Self-service email change (#057, #023).
 *
 * The account is addressed by **id**, never by the old email, which is what makes
 * the address safe to change at all. Two proofs are required, in order: a code
 * mailed to the CURRENT address, then a code mailed to the NEW address — only the
 * second one moves the account. These tests pin the parts where a mistake is
 * silent: which inbox gets which code, and that no step can be skipped.
 */

interface StoredRequest {
  id: number;
  userId: number;
  newEmail: string;
  stage: string;
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
        stage: 'new',
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
        stage: 'new',
        codeHash: '',
        expiresAt: new Date(),
        attempts: 0,
        createdAt: new Date(),
        ...data,
      };
      return Promise.resolve(stored);
    }),
    update: jest.fn((_where: unknown, patch: Partial<StoredRequest>) => {
      if (stored) Object.assign(stored, patch);
      return Promise.resolve({ affected: 1 });
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

async function pendingFor(
  code: string,
  overrides: Partial<StoredRequest> = {},
  opts: Parameters<typeof makeService>[0] = {},
) {
  return makeService({
    ...opts,
    pending: {
      newEmail: 'new@esim.vn',
      codeHash: await bcrypt.hash(code, 10),
      ...overrides,
    },
  });
}

describe('Requesting an email change', () => {
  it('should mail the first code to the CURRENT address (#023)', async () => {
    const { service, mails, current } = makeService();

    await service.requestChange(7, 'New@Esim.vn');

    expect(mails).toHaveLength(1);
    // The account's own inbox must agree before anything else happens.
    expect(mails[0].to).toBe('old@esim.vn');
    expect(mails[0].otp).toMatch(/^\d{6}$/);
    expect(current()).toMatchObject({
      newEmail: 'new@esim.vn',
      stage: 'current',
    });
    // Never stored in the clear.
    expect(current()!.codeHash).not.toBe(mails[0].otp);
    await expect(
      bcrypt.compare(mails[0].otp, current()!.codeHash),
    ).resolves.toBe(true);
  });

  it('should go straight to the new address for an account with no email', async () => {
    const { service, mails, current } = makeService({
      user: { id: 7, email: null },
    });

    await service.requestChange(7, 'new@esim.vn');

    expect(mails[0].to).toBe('new@esim.vn');
    expect(current()!.stage).toBe('new');
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

  it('should restart a stale request rather than keep two', async () => {
    const { service, mails, current } = makeService({
      pending: {
        newEmail: 'first@esim.vn',
        stage: 'new',
        createdAt: new Date(Date.now() - 5 * 60_000),
      },
    });

    await service.requestChange(7, 'second@esim.vn');

    expect(mails[0].to).toBe('old@esim.vn');
    expect(current()).toMatchObject({
      newEmail: 'second@esim.vn',
      stage: 'current',
    });
  });
});

describe('Verifying the current email (#023)', () => {
  it('should move on to the new address and mail it a separate code', async () => {
    const { service, mails, current, updates } = await pendingFor('111111', {
      stage: 'current',
      attempts: 2,
    });

    const result = await service.verifyCurrentEmail(7, '111111');

    expect(result).toEqual({ pendingEmail: 'new@esim.vn', stage: 'new' });
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe('new@esim.vn');
    expect(current()!.stage).toBe('new');
    expect(current()!.attempts).toBe(0);
    // A fresh code: the one from the current inbox no longer works.
    await expect(bcrypt.compare('111111', current()!.codeHash)).resolves.toBe(
      false,
    );
    await expect(
      bcrypt.compare(mails[0].otp, current()!.codeHash),
    ).resolves.toBe(true);
    // Still nothing changed on the account.
    expect(updates).toHaveLength(0);
  });

  it('should reject a wrong code, count the attempt and stay on this step', async () => {
    const { service, mails, current } = await pendingFor('111111', {
      stage: 'current',
    });

    await expect(service.verifyCurrentEmail(7, '000000')).rejects.toThrow();
    expect(mails).toHaveLength(0);
    expect(current()).toMatchObject({ stage: 'current', attempts: 1 });
  });

  it('should refuse an expired code and drop the request', async () => {
    const { service, current } = await pendingFor('111111', {
      stage: 'current',
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(service.verifyCurrentEmail(7, '111111')).rejects.toThrow();
    expect(current()).toBeNull();
  });

  it('should refuse when the current email was already verified', async () => {
    const { service, mails } = await pendingFor('111111', { stage: 'new' });

    await expect(service.verifyCurrentEmail(7, '111111')).rejects.toThrow();
    expect(mails).toHaveLength(0);
  });

  it('should refuse when nothing is pending', async () => {
    await expect(
      makeService().service.verifyCurrentEmail(7, '111111'),
    ).rejects.toThrow();
  });

  it('should stop if the new address was claimed in the meantime', async () => {
    const { service, mails } = await pendingFor(
      '111111',
      { stage: 'current' },
      { otherUserWithEmail: { id: 99, email: 'new@esim.vn' } },
    );

    await expect(service.verifyCurrentEmail(7, '111111')).rejects.toThrow();
    expect(mails).toHaveLength(0);
  });
});

describe('Confirming an email change', () => {
  it('should refuse while the current email is not verified (#023)', async () => {
    // Even the right code cannot skip step 1.
    const { service, updates } = await pendingFor('123456', {
      stage: 'current',
    });

    await expect(
      service.confirmChange(7, 'new@esim.vn', '123456'),
    ).rejects.toThrow();
    expect(updates).toHaveLength(0);
  });

  it('should move the account to the new address, keyed by id', async () => {
    const { service, updates } = await pendingFor('123456');

    await service.confirmChange(7, 'new@esim.vn', '123456');

    expect(updates).toEqual([{ id: 7, payload: { email: 'new@esim.vn' } }]);
  });

  it('should return the updated account so the site can show the new email', async () => {
    const { service } = await pendingFor('123456');

    const updated = await service.confirmChange(7, 'new@esim.vn', '123456');

    expect(updated.email).toBe('new@esim.vn');
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
  it('should report the address awaiting confirmation and its step', async () => {
    await expect(
      makeService({
        pending: { newEmail: 'new@esim.vn', stage: 'current' },
      }).service.pendingChange(7),
    ).resolves.toEqual({ pendingEmail: 'new@esim.vn', stage: 'current' });

    await expect(
      makeService({
        pending: { newEmail: 'new@esim.vn', stage: 'new' },
      }).service.pendingChange(7),
    ).resolves.toEqual({ pendingEmail: 'new@esim.vn', stage: 'new' });
  });

  it('should report nothing for an expired or absent request', async () => {
    await expect(makeService().service.pendingChange(7)).resolves.toEqual({
      pendingEmail: null,
      stage: null,
    });
    await expect(
      makeService({
        pending: { expiresAt: new Date(Date.now() - 1000) },
      }).service.pendingChange(7),
    ).resolves.toEqual({ pendingEmail: null, stage: null });
  });
});
