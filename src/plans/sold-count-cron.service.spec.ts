import { SoldCountCronService } from './sold-count-cron.service';

/** #053 — the hourly job that keeps "units sold" current. */
describe('SoldCountCronService', () => {
  it('should recount units sold', async () => {
    const plansService = {
      recalculateSoldCounts: jest.fn().mockResolvedValue(undefined),
    };
    const cron = new SoldCountCronService(plansService as never);

    await cron.recalculate();

    expect(plansService.recalculateSoldCounts).toHaveBeenCalledTimes(1);
  });

  it('should not throw when the recount fails, so the next run can retry', async () => {
    const plansService = {
      recalculateSoldCounts: jest.fn().mockRejectedValue(new Error('db down')),
    };
    const cron = new SoldCountCronService(plansService as never);

    await expect(cron.recalculate()).resolves.toBeUndefined();
  });
});
