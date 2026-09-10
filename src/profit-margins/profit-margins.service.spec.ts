import { ProfitMarginsService } from './profit-margins.service';

describe('ProfitMarginsService local inventory pricing', () => {
  it('should apply an existing percentage tier to a newly created Viettel cost', async () => {
    const tierRepository = {
      findAll: jest.fn().mockResolvedValue([
        {
          minVnd: 0,
          maxVnd: 100000,
          percentage: 20,
          fixedAmountVnd: 0,
        },
      ]),
    };
    const service = new ProfitMarginsService(
      tierRepository as never,
      {} as never,
    );

    await expect(service.calculateRetailVndFromLocalCost(50000)).resolves.toBe(
      60000,
    );
  });

  it('should give fixed margin precedence and round to 1,000 VND', async () => {
    const tierRepository = {
      findAll: jest.fn().mockResolvedValue([
        {
          minVnd: 0,
          maxVnd: 100000,
          percentage: 99,
          fixedAmountVnd: 7500,
        },
      ]),
    };
    const service = new ProfitMarginsService(
      tierRepository as never,
      {} as never,
    );

    await expect(service.calculateRetailVndFromLocalCost(50100)).resolves.toBe(
      58000,
    );
  });
});
