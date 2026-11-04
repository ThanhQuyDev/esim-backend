import { EsimsService } from './esims.service';

/** vande-0411 #035 — a day pass sold for 14 days does not read 1 day. */
describe('eSIM list days (vande-0411 #035)', () => {
  it('should put the days picked on each eSIM of a page', async () => {
    const svc = Object.create(EsimsService.prototype) as EsimsService;
    const findChosenDaysByIds = jest.fn().mockResolvedValue(new Map([[1, 14]]));
    Object.assign(svc, {
      esimsRepository: {
        countTopupsByIccids: jest.fn().mockResolvedValue(new Map()),
        findOrderNumbersByOrderItemIds: jest.fn().mockResolvedValue(new Map()),
        findChosenDaysByIds,
      },
    });

    const [dayPass, fixed] = await svc.attachTopupInfo([
      { id: 1, iccid: 'a' },
      { id: 2, iccid: 'b' },
    ] as never);

    expect(dayPass.chosenDays).toBe(14);
    expect(fixed.chosenDays).toBeNull();
    expect(findChosenDaysByIds).toHaveBeenCalledTimes(1);
  });
});
