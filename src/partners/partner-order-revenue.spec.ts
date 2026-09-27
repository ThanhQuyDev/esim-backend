import { PartnersService } from './partners.service';
import { PartnerTypeEnum } from './partners.enum';

/**
 * Order revenue in the partner's own screens (#020).
 *
 * The list showed 0đ for real orders. `vndPrice` is only the part a customer
 * paid with money — an order settled from their eXU wallet stores 0 there —
 * so the partner saw a commission next to a revenue of nothing. The figure is
 * now the same base the commission is calculated from.
 */

function buildService() {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  const sql: string[] = [];

  Object.assign(service, {
    getPartnerOrThrowById: jest.fn().mockResolvedValue({
      id: 5,
      partnerType: PartnerTypeEnum.KOL,
      tierCode: null,
    }),
    dataSource: {
      query: jest.fn((query: string) => {
        sql.push(query);
        return Promise.resolve([{}]);
      }),
    },
    getWalletSummaryForPartner: jest.fn().mockResolvedValue({ balanceVnd: 0 }),
    tierRepository: { find: jest.fn().mockResolvedValue([]) },
  });

  return { service, sql };
}

describe('PartnersService — what an attributed order is worth (#020)', () => {
  it('should not read revenue from the money-only column in the order list', async () => {
    const { service, sql } = buildService();

    await service.getMyOrders(5);

    // The old query summed `o."vndPrice"` straight, which is 0 on a
    // wallet-settled order.
    expect(sql[0]).toContain('eligibleSpendVnd');
    expect(sql[0]).toContain('walletSpentVndAmount');
  });

  it('should use the same figure for the dashboard totals', async () => {
    const { service, sql } = buildService();

    await service.getMySummary(5);

    expect(sql[0]).toContain('eligibleSpendVnd');
  });

  it('should try payable plus wallet as one sum, not payable alone', async () => {
    const { service, sql } = buildService();

    await service.getMyOrders(5);

    // `NULLIF(payable, 0) + wallet` would be NULL for a wallet-only order and
    // fall through to the legacy 0, which is the bug this item is about.
    expect(sql[0]).toContain(
      'NULLIF(o."payableVndPrice" + o."walletSpentVndAmount", 0)',
    );
  });
});
