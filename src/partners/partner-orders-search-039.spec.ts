import { PartnersService } from './partners.service';
import { PartnerTypeEnum } from './partners.enum';

/**
 * doitac-3010 #039 — "Đơn hàng đối tác" in the admin: one search box for the
 * order, ICCID, email and product, and up to 1000 orders paged on the screen.
 */
describe('Admin partner orders (doitac-3010 #039)', () => {
  const run = async (query: Record<string, unknown>) => {
    const service = Object.create(PartnersService.prototype) as PartnersService;
    const getMyOrders = jest.fn().mockResolvedValue([]);
    const getMyPurchases = jest.fn().mockResolvedValue([]);
    Object.assign(service, { getMyOrders, getMyPurchases });
    await service.adminListPartnerOrders(query as never);
    return { getMyOrders, getMyPurchases };
  };

  it('should hand the screen up to 1000 marketing orders', async () => {
    const { getMyOrders } = await run({ limit: 1000, search: 'abc@x.vn' });
    expect(getMyOrders.mock.calls[0][1]).toBe(1000);
    expect(getMyOrders.mock.calls[0][2].search).toBe('abc@x.vn');
  });

  it('should cap a larger page at 1000', async () => {
    const { getMyOrders } = await run({ limit: 99999 });
    expect(getMyOrders.mock.calls[0][1]).toBe(1000);
  });

  it('should hand distribution purchases the same limit', async () => {
    const { getMyPurchases } = await run({
      partnerType: PartnerTypeEnum.DISTRIBUTION,
      limit: 1000,
    });
    expect(getMyPurchases.mock.calls[0][1].limit).toBe(1000);
  });
});
