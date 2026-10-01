import { OrdersService } from './orders.service';
import { RoleEnum } from '../roles/roles.enum';
import { StatusEnum } from '../statuses/statuses.enum';

/**
 * #041 — đặt đơn hộ used to refuse an email with no account, which meant telling
 * the customer to go and register: exactly the errand staff are placing the order
 * to spare them. The account is created instead.
 *
 * What must NOT happen: a password being minted for someone who never signed up,
 * a duplicate account when the email already exists, or the order being attached
 * to the wrong person.
 */
describe('Manual order for an unknown email (#041)', () => {
  const PLAN = {
    id: 3,
    slug: 'ID_1_7',
    providerPlanId: 'JC056',
    currency: 'USD',
  };

  function makeService(opts: { existingBuyer?: { id: number } | null } = {}) {
    const created: Record<string, unknown>[] = [];

    const usersService = {
      findByEmail: jest.fn().mockResolvedValue(opts.existingBuyer ?? null),
      create: jest.fn((dto: Record<string, unknown>) => {
        created.push(dto);
        return Promise.resolve({ id: 99, ...dto });
      }),
    };

    const service = Object.create(OrdersService.prototype) as OrdersService;
    const internals = service as unknown as Record<string, unknown>;

    internals.usersService = usersService;
    internals.plansService = {
      findBySlug: jest.fn().mockResolvedValue(PLAN),
    };
    internals.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    internals.createPendingOrder = jest
      .fn()
      .mockImplementation((userId: number) =>
        Promise.resolve({ id: 11, orderNumber: 'MAN-1', userId }),
      );
    internals.exchangeRateService = {
      getUsdToVndRate: jest.fn().mockResolvedValue(25000),
    };
    internals.finalizePaidOrder = jest.fn().mockResolvedValue(undefined);
    internals.submitProviders = jest.fn().mockResolvedValue(undefined);
    internals.orderRepository = {
      findById: jest.fn().mockResolvedValue({ id: 11, orderNumber: 'MAN-1' }),
    };

    return { service, usersService, created, internals };
  }

  const DTO = {
    email: 'khachquen@example.com',
    packageCode: 'JC056',
    slug: 'ID_1_7',
    quantity: 1,
  };

  it('should creates the account and places the order under it', async () => {
    const { service, usersService, internals } = makeService();

    await service.submitManualOrder(5, DTO);

    expect(usersService.create).toHaveBeenCalledTimes(1);
    expect(internals.createPendingOrder).toHaveBeenCalledWith(
      99,
      expect.anything(),
      expect.any(String),
      expect.any(Number),
    );
  });

  it('should never sets a password for someone who did not sign up', async () => {
    // An unsolicited credentials email is worse than none, and the customer only
    // asked for an eSIM. "Quên mật khẩu" is there if they ever want to log in.
    const { service, created } = makeService();

    await service.submitManualOrder(5, DTO);

    expect(created[0]).not.toHaveProperty('password');
    expect(created[0].password).toBeUndefined();
  });

  it('should creates a normal active customer, not an admin or a pending account', async () => {
    const { service, created } = makeService();

    await service.submitManualOrder(5, DTO);

    expect(created[0]).toMatchObject({
      email: DTO.email,
      role: { id: RoleEnum.user },
      status: { id: StatusEnum.active },
    });
  });

  it('should stores the name the admin typed', async () => {
    const { service, created } = makeService();

    await service.submitManualOrder(5, {
      ...DTO,
      customerName: '  Nguyễn Văn A  ',
    });

    expect(created[0].firstName).toBe('Nguyễn Văn A');
  });

  it('should leaves the name null rather than guessing one from the email', async () => {
    const { service, created } = makeService();

    await service.submitManualOrder(5, { ...DTO, customerName: '   ' });

    expect(created[0].firstName).toBeNull();
    expect(created[0].lastName).toBeNull();
  });

  it('should reuses an existing account instead of creating a second one', async () => {
    const { service, usersService, internals } = makeService({
      existingBuyer: { id: 42 },
    });

    await service.submitManualOrder(5, DTO);

    expect(usersService.create).not.toHaveBeenCalled();
    expect(internals.createPendingOrder).toHaveBeenCalledWith(
      42,
      expect.anything(),
      expect.any(String),
      expect.any(Number),
    );
  });

  it('should still refuses when the slug and packageCode disagree', async () => {
    // #040 moved this behind a picker, but the guard has to stay: it is what
    // stops the wrong eSIM being provisioned.
    const { service } = makeService();

    await expect(
      service.submitManualOrder(5, { ...DTO, packageCode: 'WRONG' }),
    ).rejects.toThrow(/does not match packageCode/);
  });

  it('should leaves no stray account behind when the plan is rejected', async () => {
    // Resolving the buyer now creates an account, so it has to happen after the
    // plan checks — otherwise a mistyped package code registers a customer for
    // an order that never existed.
    const { service, usersService } = makeService();

    await expect(
      service.submitManualOrder(5, { ...DTO, packageCode: 'WRONG' }),
    ).rejects.toThrow();

    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('should leaves no stray account behind when the plan is not found', async () => {
    const { service, usersService, internals } = makeService();
    (internals.plansService as { findBySlug: jest.Mock }).findBySlug = jest
      .fn()
      .mockResolvedValue(null);

    await expect(service.submitManualOrder(5, DTO)).rejects.toThrow(
      /not found/,
    );

    expect(usersService.create).not.toHaveBeenCalled();
  });
});
