import { of, throwError } from 'rxjs';
import { AiraloService } from './airalo.service';

/**
 * vande-2011 #009: "Topup hộ khách" for an Airalo eSIM failed or hung while
 * Airalo answered 429. Never the real API.
 */
describe('Airalo top-up under a rate limit (vande-2011 #009)', () => {
  const config = {
    get: () => 'https://airalo.test/api',
    getOrThrow: (key: string) =>
      key === 'airalo.baseUrl' ? 'https://airalo.test/api' : 'x',
  };
  const rateLimited = () =>
    throwError(() => ({
      response: { status: 429, headers: { 'retry-after': '1' } },
      message: 'Request failed with status code 429',
    }));

  function make(get: jest.Mock, post?: jest.Mock) {
    const http = {
      axiosRef: { interceptors: { response: { use: () => 0 } } },
      post:
        post ??
        jest.fn(() =>
          of({ data: { data: { access_token: 'tok', expires_in: 3600 } } }),
        ),
      get,
    };
    return new AiraloService(
      http as never,
      config as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  beforeEach(() => jest.useFakeTimers({ advanceTimers: true }));
  afterEach(() => jest.useRealTimers());

  it('should ask once more after a short 429 and keep the list for a minute', async () => {
    const get = jest
      .fn()
      .mockImplementationOnce(rateLimited)
      .mockImplementation(() => of({ data: { data: [{ id: 'p1' }] } }));
    const service = make(get);
    await expect(service.listTopupPackages('8900')).resolves.toEqual([
      { id: 'p1' },
    ]);
    await service.listTopupPackages('8900');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('should give up at once when Airalo asks to wait long', async () => {
    const get = jest.fn(() =>
      throwError(() => ({
        response: { status: 429, headers: { 'retry-after': '60' } },
      })),
    );
    const service = make(get);
    await expect(service.listTopupPackages('8901')).rejects.toBeTruthy();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('should submit a top-up again after a 429, which bought nothing', async () => {
    let orders = 0;
    const post = jest.fn((url: string) => {
      if (url.endsWith('/v2/token')) {
        return of({
          data: { data: { access_token: 'tok', expires_in: 3600 } },
        });
      }
      orders++;
      return orders === 1
        ? rateLimited()
        : of({ data: { data: { id: 7, code: 'T-7' } } });
    });
    const service = make(jest.fn(), post as never);
    await expect(
      service.submitTopup({ packageId: 'pk', iccid: '8902' }),
    ).resolves.toEqual({ id: 7, code: 'T-7' });
    expect(orders).toBe(2);
  });
});
