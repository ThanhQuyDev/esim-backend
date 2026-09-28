import { PartnersService } from './partners.service';

/**
 * "Đơn hàng đối tác" on the admin side (#071).
 *
 * Deliberately the same read models the partners see on their own screens,
 * with the partner filter opened up. Rebuilding the queries here would let the
 * admin's figures drift from the partner's, and a partner disputing a number
 * needs both screens to agree.
 */

function buildService() {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  const getMyOrders = jest.fn().mockResolvedValue([]);
  const getMyPurchases = jest.fn().mockResolvedValue([]);
  Object.assign(service, { getMyOrders, getMyPurchases });
  return { service, getMyOrders, getMyPurchases };
}

describe('PartnersService.adminListPartnerOrders (#071)', () => {
  it('should read a distribution tab as the purchases screen', async () => {
    const { service, getMyPurchases, getMyOrders } = buildService();

    await service.adminListPartnerOrders({ partnerType: 'distribution' });

    expect(getMyPurchases).toHaveBeenCalled();
    expect(getMyOrders).not.toHaveBeenCalled();
  });

  it('should read a marketing tab as the attributed-orders screen', async () => {
    const { service, getMyOrders, getMyPurchases } = buildService();

    await service.adminListPartnerOrders({ partnerType: 'kol' });

    expect(getMyOrders).toHaveBeenCalled();
    expect(getMyPurchases).not.toHaveBeenCalled();
  });

  it('should ask for every partner when the select box is empty', async () => {
    // No partner chosen is the whole programme, not partner zero.
    const { service, getMyOrders } = buildService();

    await service.adminListPartnerOrders({});

    expect(getMyOrders).toHaveBeenCalledWith(null, 50, expect.any(Object));
  });

  it('should scope to the partner the admin picked', async () => {
    const { service, getMyOrders } = buildService();

    await service.adminListPartnerOrders({ partnerId: 14, search: 'ORD-1' });

    expect(getMyOrders).toHaveBeenCalledWith(14, 50, {
      search: 'ORD-1',
      status: undefined,
    });
  });

  it('should refuse to fetch an unbounded page', async () => {
    const { service, getMyOrders } = buildService();

    await service.adminListPartnerOrders({ limit: 100_000 });

    expect(getMyOrders).toHaveBeenCalledWith(null, 200, expect.any(Object));
  });
});

describe('PartnersService.adminPartnerOptions (#071)', () => {
  function buildOptionsService(rows: Record<string, unknown>[]) {
    const query = jest.fn().mockResolvedValue(rows);
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, { dataSource: { query } });
    return { service, query };
  }

  it('should name every partner for the select box', async () => {
    const { service } = buildOptionsService([
      { id: '14', name: 'Nguyễn Văn A', email: 'a@example.com' },
    ]);

    const options = await service.adminPartnerOptions();

    expect(options).toEqual([
      { id: 14, name: 'Nguyễn Văn A', email: 'a@example.com' },
    ]);
  });

  it('should fall back to the id for a partner with no name on file', async () => {
    // A blank line in a select box is unpickable.
    const { service } = buildOptionsService([
      { id: '14', name: null, email: null },
    ]);

    const options = await service.adminPartnerOptions();

    expect(options[0].name).toBe('Đối tác #14');
  });

  it('should narrow the box to the tab that is open', async () => {
    const { service, query } = buildOptionsService([]);

    await service.adminPartnerOptions('distribution');

    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params[0]).toBe('distribution');
  });

  it('should leave deleted partners out of the box', async () => {
    const { service, query } = buildOptionsService([]);

    await service.adminPartnerOptions();

    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain('"deletedAt" IS NULL');
  });
});
