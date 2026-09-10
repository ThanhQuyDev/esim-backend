import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { QueryCouponDto } from './dto/query-coupon.dto';
import { RoleEnum } from '../roles/roles.enum';

/**
 * Public vs. private discount codes (#081).
 *
 * `GET /coupons` needs no token and the cart page lists whatever it returns, so
 * the filtering has to happen on the server: a private code that reaches the
 * browser is already public. Admins keep the unfiltered view for the CMS.
 */
describe('CouponsController — coupon visibility', () => {
  function setup() {
    const findManyWithPagination = jest.fn().mockResolvedValue([[], 0]);
    const service = { findManyWithPagination } as unknown as CouponsService;
    return {
      controller: new CouponsController(service),
      findManyWithPagination,
    };
  }

  const anonymous = {} as { user?: { role?: { id?: number | string } } };
  const admin = { user: { role: { id: RoleEnum.admin } } };
  const customer = { user: { role: { id: RoleEnum.user } } };

  function query(filters?: Record<string, unknown>): QueryCouponDto {
    return { filters } as unknown as QueryCouponDto;
  }

  it('should hide private codes from an anonymous shopper', async () => {
    const { controller, findManyWithPagination } = setup();

    await controller.findAll(anonymous, query());

    expect(findManyWithPagination).toHaveBeenCalledWith(
      expect.objectContaining({ filterOptions: { isPublic: true } }),
    );
  });

  it('should hide private codes from a signed-in customer too', async () => {
    const { controller, findManyWithPagination } = setup();

    await controller.findAll(customer, query({ isActive: true }));

    expect(findManyWithPagination).toHaveBeenCalledWith(
      expect.objectContaining({
        filterOptions: { isActive: true, isPublic: true },
      }),
    );
  });

  it('should refuse to let a caller ask for private codes', async () => {
    const { controller, findManyWithPagination } = setup();

    // The cart page can pass any filters it likes; `isPublic: false` must not
    // be honoured for anyone but an admin.
    await controller.findAll(anonymous, query({ isPublic: false }));

    expect(findManyWithPagination).toHaveBeenCalledWith(
      expect.objectContaining({ filterOptions: { isPublic: true } }),
    );
  });

  it('should give an admin the unfiltered listing', async () => {
    const { controller, findManyWithPagination } = setup();

    await controller.findAll(admin, query());

    expect(findManyWithPagination).toHaveBeenCalledWith(
      expect.objectContaining({ filterOptions: undefined }),
    );
  });

  it('should let an admin filter down to private codes', async () => {
    const { controller, findManyWithPagination } = setup();

    await controller.findAll(admin, query({ isPublic: false }));

    expect(findManyWithPagination).toHaveBeenCalledWith(
      expect.objectContaining({ filterOptions: { isPublic: false } }),
    );
  });
});

describe('CouponsService — visibility defaults', () => {
  function setup() {
    const create = jest.fn().mockResolvedValue({});
    const update = jest.fn().mockResolvedValue({});
    const repository = {
      create,
      update,
      findByCode: jest.fn().mockResolvedValue(null),
    };
    const service = new CouponsService(
      repository as never,
      { findOne: jest.fn() } as never,
    );
    return { service, create, update };
  }

  it('should make a new code public unless the admin says otherwise', async () => {
    const { service, create } = setup();

    await service.create({ code: 'SUMMER10', discountPercent: 10 } as never);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ isPublic: true }),
    );
  });

  it('should keep a code private when it is created that way', async () => {
    const { service, create } = setup();

    await service.create({
      code: 'VIPONLY',
      discountPercent: 20,
      isPublic: false,
    } as never);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ isPublic: false }),
    );
  });

  it('should leave visibility alone when an edit does not mention it', async () => {
    const { service, update } = setup();

    await service.update(7, { discountPercent: 15 } as never);

    expect(update).toHaveBeenCalledWith(
      7,
      expect.not.objectContaining({ isPublic: expect.anything() }),
    );
  });

  it('should switch an existing code to private', async () => {
    const { service, update } = setup();

    await service.update(7, { isPublic: false } as never);

    expect(update).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ isPublic: false }),
    );
  });
});
