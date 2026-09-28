import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { RoleEnum } from '../roles/roles.enum';
import { PartnerStatusEnum, PartnerTypeEnum } from '../partners/partners.enum';

/**
 * A partner application still awaiting approval must not be able to sign in
 * (#001). Letting them in showed a portal whose every menu was empty; now the
 * sign-in page tells them to watch the inbox they registered with.
 */

const PASSWORD = 'partner-pass';

async function makeService(partner: Record<string, unknown> | null) {
  const service = Object.create(AuthService.prototype) as AuthService;
  const internals = service as unknown as Record<string, unknown>;

  const user = {
    id: 11,
    email: 'kol@esim.vn',
    password: await bcrypt.hash(PASSWORD, 10),
    role: { id: RoleEnum.partner },
  };

  const createdSessions: unknown[] = [];

  internals.usersService = {
    findByEmail: jest.fn().mockResolvedValue(user),
    // Stamping "last signed in" is bookkeeping alongside the sign-in (#060).
    update: jest.fn().mockResolvedValue(undefined),
  };
  internals.sessionService = {
    create: jest.fn((args: unknown) => {
      createdSessions.push(args);
      return Promise.resolve({ id: 1 });
    }),
  };
  internals.partnersRepository = {
    findOne: jest.fn().mockResolvedValue(partner),
  };
  internals.getTokensData = jest.fn().mockResolvedValue({
    token: 't',
    refreshToken: 'r',
    tokenExpires: 1,
  });

  return { service, createdSessions };
}

describe('sign-in while the partner profile is pending (#001)', () => {
  it('should refuse the login and explain the 1-3 working day wait', async () => {
    const { service, createdSessions } = await makeService({
      id: 3,
      partnerType: PartnerTypeEnum.KOL,
      status: PartnerStatusEnum.PENDING,
    });

    await expect(
      service.validateLogin({ email: 'kol@esim.vn', password: PASSWORD }),
    ).rejects.toMatchObject({
      response: {
        message:
          'Tài khoản tiếp thị của bạn đang chờ xét duyệt, vui lòng theo dõi kết quả được gửi qua email đã đăng ký trong 1 - 3 ngày làm việc. Xin cảm ơn.',
        errors: { email: 'partnerPending' },
      },
    });

    // No session means no token, so no menu of the portal is reachable.
    expect(createdSessions).toHaveLength(0);
  });

  it('should name the distribution partner in its own words', async () => {
    const { service } = await makeService({
      id: 4,
      partnerType: PartnerTypeEnum.DISTRIBUTION,
      status: PartnerStatusEnum.PENDING,
    });

    await expect(
      service.validateLogin({ email: 'kol@esim.vn', password: PASSWORD }),
    ).rejects.toMatchObject({
      response: {
        message: expect.stringContaining('Tài khoản đối tác phân phối'),
      },
    });
  });

  it('should answer a rejected application like an unknown account (#003)', async () => {
    const { service, createdSessions } = await makeService({
      id: 6,
      partnerType: PartnerTypeEnum.KOL,
      status: PartnerStatusEnum.REJECTED,
    });

    // They were told to fill the form in again, not to sign in — so they get
    // the same answer as someone who never registered.
    await expect(
      service.validateLogin({ email: 'kol@esim.vn', password: PASSWORD }),
    ).rejects.toMatchObject({
      response: { errors: { email: 'notFound' } },
    });

    expect(createdSessions).toHaveLength(0);
  });

  it('should let an approved partner through', async () => {
    const { service, createdSessions } = await makeService({
      id: 5,
      partnerType: PartnerTypeEnum.KOL,
      status: PartnerStatusEnum.ACTIVE,
    });

    await expect(
      service.validateLogin({ email: 'kol@esim.vn', password: PASSWORD }),
    ).resolves.toMatchObject({ token: 't' });

    expect(createdSessions).toHaveLength(1);
  });
});
