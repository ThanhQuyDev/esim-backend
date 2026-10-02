import {
  ExchangeRateService,
  FALLBACK_USD_CNY_RATE,
  FALLBACK_USD_VND_RATE,
} from './exchange-rate.service';

/**
 * Tỷ giá CNY→USD cho danh mục Billion (#billion-currency).
 *
 * Con số này đặt giá vốn cho ~16 nghìn gói Billion, nên mỗi ca ở đây canh một
 * cách sai có thật: quy đổi ngược chiều (bán đắt gấp 50 lần), hoặc trả về 0 /
 * NaN khi API hỏng (bán 0đ).
 */
describe('ExchangeRateService — CNY', () => {
  const service = () => new ExchangeRateService();

  const mockFetch = (body: unknown, ok = true) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 503,
      json: () => Promise.resolve(body),
    }) as never;
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return dollars per yuan, not yuan per dollar', () => {
    // Trả về 7.1 thay vì 1/7.1 sẽ biến gói 6 tệ thành 42 USD — đắt gấp 50 lần
    // thực tế. Đây là cách sai dễ xảy ra nhất.
    mockFetch({ rates: { VND: 25000, CNY: 7.1 } });

    return service()
      .getCnyToUsdRate()
      .then((rate) => {
        expect(rate).toBeCloseTo(1 / 7.1, 6);
        expect(rate).toBeLessThan(1);
      });
  });

  it('should convert the real catalogue figures into a believable band', async () => {
    mockFetch({ rates: { VND: 25000, CNY: 7.1 } });
    const rate = await service().getCnyToUsdRate();

    // Korea 500MB/ngày 1 ngày: Billion 3.00 tệ. Các nhà cung cấp USD đã biết
    // bán 0.29–0.48, nên sau quy đổi phải nằm quanh đó.
    expect(3.0 * rate).toBeGreaterThan(0.2);
    expect(3.0 * rate).toBeLessThan(0.8);
    // Korea 3GB/ngày, 30 ngày: 128 tệ → khoảng 18 USD.
    expect(128 * rate).toBeGreaterThan(10);
    expect(128 * rate).toBeLessThan(25);
  });

  it('should serve both rates from one fetch', async () => {
    mockFetch({ rates: { VND: 25000, CNY: 7.1 } });
    const s = service();

    const [vnd, cny] = await Promise.all([
      s.getUsdToVndRate(),
      s.getCnyToUsdRate(),
    ]);

    expect(vnd).toBe(25000);
    expect(cny).toBeCloseTo(1 / 7.1, 6);
    // Một lượt đồng bộ gọi hàng nghìn lần; gọi API mỗi lần sẽ bị chặn tần suất.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should keep a good VND rate when only CNY is missing', async () => {
    // Mất CNY không phải lý do để bỏ luôn tỷ giá VND đang dùng được.
    mockFetch({ rates: { VND: 26000 } });
    const s = service();

    expect(await s.getUsdToVndRate()).toBe(26000);
    expect(await s.getCnyToUsdRate()).toBeCloseTo(1 / FALLBACK_USD_CNY_RATE, 6);
  });

  it('should never return 0 or NaN when the API is down', async () => {
    mockFetch({}, false);
    const rate = await service().getCnyToUsdRate();

    // Tỷ giá 0 làm giá vốn thành 0 và bán không lấy tiền.
    expect(Number.isFinite(rate)).toBe(true);
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeCloseTo(1 / FALLBACK_USD_CNY_RATE, 6);
  });

  it('should never return 0 or NaN when the request throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as never;
    const s = service();

    expect(await s.getCnyToUsdRate()).toBeCloseTo(1 / FALLBACK_USD_CNY_RATE, 6);
    expect(await s.getUsdToVndRate()).toBe(FALLBACK_USD_VND_RATE);
  });

  it('should reject a nonsense CNY rate rather than price from it', async () => {
    for (const bad of [0, -7, 'abc', null]) {
      mockFetch({ rates: { VND: 25000, CNY: bad } });
      const rate = await service().getCnyToUsdRate();
      expect(rate).toBeCloseTo(1 / FALLBACK_USD_CNY_RATE, 6);
    }
  });

  it('should prefer a stale cached rate over the constant', async () => {
    mockFetch({ rates: { VND: 25000, CNY: 6.9 } });
    const s = service();
    expect(await s.getCnyToUsdRate()).toBeCloseTo(1 / 6.9, 6);

    // Hết hạn cache rồi API hỏng: tỷ giá hôm qua vẫn gần đúng hơn hằng số.
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 2 * 60 * 60 * 1000);
    mockFetch({}, false);

    expect(await s.getCnyToUsdRate()).toBeCloseTo(1 / 6.9, 6);
  });
});
