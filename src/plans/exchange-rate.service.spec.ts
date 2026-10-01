import {
  ExchangeRateService,
  FALLBACK_USD_VND_RATE,
  convertAmount,
  toUsd,
  toVnd,
} from './exchange-rate.service';

/**
 * #009 — every plan must carry both a VND and a USD figure whatever currency its
 * supplier quotes, so a total mixing Viettel with an API supplier means anything.
 */
describe('convertAmount', () => {
  const RATE = 25000;

  it('should derive đồng for a dollar-quoted supplier', () => {
    // 1.43 × 25000 = 35_750 → rounded to the nearest thousand, as prices show.
    expect(convertAmount(1.43, 'USD', RATE)).toEqual({ vnd: 36000, usd: 1.43 });
  });

  it('should derive dollars for a đồng-quoted supplier (Viettel, Excel upload)', () => {
    expect(convertAmount(250000, 'VND', RATE)).toEqual({
      vnd: 250000,
      usd: 10,
    });
  });

  it('should round dollars to cents rather than truncating', () => {
    // 179000 / 25000 = 7.16
    expect(convertAmount(179000, 'VND', RATE).usd).toBe(7.16);
  });

  it('should treat a missing currency as dollars, the API default', () => {
    expect(convertAmount(2, null, RATE)).toEqual({ vnd: 50000, usd: 2 });
  });

  it('should be case-insensitive about the currency code', () => {
    expect(convertAmount(250000, 'vnd', RATE).usd).toBe(10);
  });

  it('should return zeroes for a missing or zero amount instead of NaN', () => {
    expect(convertAmount(null, 'USD', RATE)).toEqual({ vnd: 0, usd: 0 });
    expect(convertAmount(0, 'VND', RATE)).toEqual({ vnd: 0, usd: 0 });
    expect(convertAmount(undefined, 'VND', RATE)).toEqual({ vnd: 0, usd: 0 });
  });

  it('should never divide by a zero rate', () => {
    expect(toUsd(250000, 0)).toBe(0);
    expect(toVnd(10, 0)).toBe(0);
  });
});

describe('ExchangeRateService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function mockRate(rate: number) {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rates: { VND: rate } }),
    });
    global.fetch = fetchMock as never;
    return fetchMock;
  }

  it('should read the live rate', async () => {
    mockRate(25887.1);
    await expect(new ExchangeRateService().getUsdToVndRate()).resolves.toBe(
      25887.1,
    );
  });

  it('should cache, so a thousand-row upload does not hit the rate API a thousand times', async () => {
    const fetchMock = mockRate(25000);
    const service = new ExchangeRateService();

    await service.getUsdToVndRate();
    await service.getUsdToVndRate();
    await service.getUsdToVndRate();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should share one in-flight request between concurrent callers', async () => {
    const fetchMock = mockRate(25000);
    const service = new ExchangeRateService();

    await Promise.all([
      service.getUsdToVndRate(),
      service.getUsdToVndRate(),
      service.getUsdToVndRate(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should fall back instead of throwing when the rate API is down', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down')) as never;
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(new ExchangeRateService().getUsdToVndRate()).resolves.toBe(
      FALLBACK_USD_VND_RATE,
    );
  });

  it('should prefer a stale rate over the hardcoded constant', async () => {
    const service = new ExchangeRateService();
    mockRate(26000);
    await service.getUsdToVndRate();

    // Expire the cache, then break the API.
    (service as unknown as { cached: { at: number } }).cached.at = 0;
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 503 }) as never;
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(service.getUsdToVndRate()).resolves.toBe(26000);
  });

  it('should reject a nonsense rate from the API', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rates: {} }),
    }) as never;
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(new ExchangeRateService().getUsdToVndRate()).resolves.toBe(
      FALLBACK_USD_VND_RATE,
    );
  });
});
