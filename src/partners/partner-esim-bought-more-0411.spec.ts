import { PartnersService } from './partners.service';

/** vande-0411 #024 — the eSIM row says what was bought on top of it. */
describe('PartnersService.getMyEsims (vande-0411 #024)', () => {
  async function rowWith(bought: unknown) {
    const svc = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(svc, {
      getPartnerOrThrowById: jest.fn().mockResolvedValue({ userId: 280 }),
      dataSource: {
        query: jest.fn().mockResolvedValue([{ durationDays: 30, bought }]),
      },
    });
    return (await svc.getMyEsims(1))[0];
  }

  it('should count top-ups and add-ons and add the days', async () => {
    const row = await rowWith({ topups: 2, addons: 1, days: 10 });

    expect(row).toMatchObject({
      topupCount: 2,
      addonCount: 1,
      durationDays: 40,
    });
  });

  it('should read zero on an eSIM with nothing bought on top', async () => {
    const row = await rowWith({ topups: 0, addons: 0, days: 0 });

    expect(row).toMatchObject({
      topupCount: 0,
      addonCount: 0,
      durationDays: 30,
    });
  });
});
