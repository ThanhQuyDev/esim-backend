import { PartnersService } from './partners.service';

/** doitac-0911 #008 — "Gửi email đối soát" on each partner. */
describe('"Gửi email đối soát" (doitac-0911 #008)', () => {
  it('should mail the monthly credit statement only to ticked partners', async () => {
    const find = jest.fn().mockResolvedValue([]);
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service as unknown as Record<string, unknown>, {
      partnerRepository: { find },
    });

    await service.sendCreditStatements('2026-10');
    expect(find).toHaveBeenCalledWith({
      where: { noDepositRequired: true, sendReconciliationEmail: true },
    });

    // The admin's own "Gửi email đối soát" button still sends.
    await service.sendCreditStatements('2026-10', 12);
    expect(find).toHaveBeenLastCalledWith({ where: { id: 12 } });
  });

  it('should save the tick for any type of partner', async () => {
    const partner = { id: 12, partnerType: 'distribution' };
    const save = jest.fn((p) => Promise.resolve(p));
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service as unknown as Record<string, unknown>, {
      partnerRepository: { save },
      adminFindById: jest.fn().mockResolvedValue(partner),
    });

    const saved = await service.setReconciliationEmail(12, true);

    expect(saved.sendReconciliationEmail).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
