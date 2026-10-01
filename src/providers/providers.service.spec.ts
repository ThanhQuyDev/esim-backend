import { BadRequestException } from '@nestjs/common';
import { ProvidersService } from './providers.service';

/**
 * #005 — "khi bấm tắt nhà cung cấp thì toàn bộ gói esim của nhà cung cấp đó
 * chuyển qua trạng thái Không hoạt động", so an admin can stop selling a broken
 * supplier in one action instead of editing a thousand plans.
 */
describe('ProvidersService', () => {
  type Row = {
    provider: string;
    isEnabled: boolean;
    disabledReason: string | null;
    disabledAt: Date | null;
  };

  function setup(
    rows: Row[] = [],
    counts: { provider: string; active: string; disabled: string }[] = [],
  ) {
    const saved: Row[] = [];
    const repository = {
      find: jest.fn().mockResolvedValue(rows),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation((data: Row) => {
        saved.push(data);
        return Promise.resolve(data);
      }),
      manager: { query: jest.fn().mockResolvedValue(counts) },
    };
    const plansService = {
      markCheapestPlans: jest.fn().mockResolvedValue(undefined),
      deactivatePlansForProvider: jest.fn().mockResolvedValue(1004),
      reactivatePlansDisabledByProvider: jest.fn().mockResolvedValue(1004),
    };
    const service = new ProvidersService(
      repository as never,
      plansService as never,
    );
    return { service, repository, plansService, saved };
  }

  it('should treats a supplier with no row as selling', async () => {
    const { service } = setup(
      [],
      [{ provider: 'billion', active: '1004', disabled: '0' }],
    );

    const list = await service.list();

    expect(list.find((row) => row.provider === 'billion')).toMatchObject({
      isEnabled: true,
      activePlanCount: 1004,
      disabledPlanCount: 0,
    });
  });

  it('should lists a supplier that was switched off, with the reason', async () => {
    const disabledAt = new Date('2026-09-29T03:00:00.000Z');
    const { service } = setup(
      [
        {
          provider: 'microesim',
          isEnabled: false,
          disabledReason: 'API lỗi',
          disabledAt,
        },
      ],
      [{ provider: 'microesim', active: '0', disabled: '52' }],
    );

    const list = await service.list();

    expect(list.find((row) => row.provider === 'microesim')).toMatchObject({
      isEnabled: false,
      disabledReason: 'API lỗi',
      disabledAt: disabledAt.toISOString(),
      activePlanCount: 0,
      disabledPlanCount: 52,
    });
  });

  it('should switching off deactivates the plans and records why', async () => {
    const { service, plansService, saved } = setup();

    await service.setSalesStatus('billion', {
      isEnabled: false,
      disabledReason: '  API nhà cung cấp lỗi  ',
    });

    expect(plansService.deactivatePlansForProvider).toHaveBeenCalledWith(
      'billion',
    );
    expect(
      plansService.reactivatePlansDisabledByProvider,
    ).not.toHaveBeenCalled();
    expect(saved[0]).toMatchObject({
      provider: 'billion',
      isEnabled: false,
      disabledReason: 'API nhà cung cấp lỗi',
    });
    expect(saved[0].disabledAt).toBeInstanceOf(Date);
  });

  it('should switching on restores only what the switch took down, and clears the reason', async () => {
    const { service, plansService, saved } = setup();

    await service.setSalesStatus('billion', { isEnabled: true });

    expect(plansService.reactivatePlansDisabledByProvider).toHaveBeenCalledWith(
      'billion',
    );
    expect(plansService.deactivatePlansForProvider).not.toHaveBeenCalled();
    expect(saved[0]).toMatchObject({
      isEnabled: true,
      disabledReason: null,
      disabledAt: null,
    });
  });

  it('should re-picks the cheapest plans, which are computed over active plans only', async () => {
    const { service, plansService } = setup();

    await service.setSalesStatus('billion', { isEnabled: false });

    expect(plansService.markCheapestPlans).toHaveBeenCalled();
  });

  it('should normalizes the slug and rejects a bogus one', async () => {
    const { service, plansService } = setup();

    await service.setSalesStatus('  BILLION  ', { isEnabled: false });
    expect(plansService.deactivatePlansForProvider).toHaveBeenCalledWith(
      'billion',
    );

    await expect(
      service.setSalesStatus('drop table plan', { isEnabled: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
