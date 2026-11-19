import { of } from 'rxjs';
import { AiraloService } from './airalo.service';

/**
 * vande-2011 #003: every Airalo call asked /v2/token first, and the 5-minute
 * usage sweeps of beta and production (one Airalo account) ran into 429. The
 * token is now kept, and a 429 pauses the work that can wait. Never the real API.
 */
describe('Airalo token and rate limit (vande-2011 #003)', () => {
  const config = {
    get: () => 'https://airalo.test/api',
    getOrThrow: (key: string) =>
      key === 'airalo.baseUrl' ? 'https://airalo.test/api' : 'x',
  };

  function make() {
    const interceptors: { rejected?: (e: unknown) => Promise<unknown> } = {};
    const http = {
      axiosRef: {
        interceptors: {
          response: {
            use: (_ok: unknown, rejected: (e: unknown) => Promise<unknown>) => {
              interceptors.rejected = rejected;
            },
          },
        },
      },
      post: jest.fn((url: string) =>
        of({
          data: url.endsWith('/v2/token')
            ? { data: { access_token: 'tok', expires_in: 31_622_400 } }
            : {},
        }),
      ),
      get: jest.fn(() =>
        of({ data: { data: { remaining: 1, total: 2, is_unlimited: false } } }),
      ),
    };
    const service = new AiraloService(
      http as never,
      config as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, http, interceptors };
  }

  it('should ask for a token once for many calls', async () => {
    const { service, http } = make();
    await Promise.all([
      service.getDataUsage('1'),
      service.getDataUsage('2'),
      service.getDataUsage('3'),
    ]);
    await service.getDataUsage('4');
    const tokenCalls = http.post.mock.calls.filter(([u]) =>
      String(u).endsWith('/v2/token'),
    );
    expect(tokenCalls).toHaveLength(1);
    expect(http.get).toHaveBeenCalledTimes(4);
  });

  it('should ask for a new token after Airalo refuses the old one', async () => {
    const { service, http, interceptors } = make();
    await service.getDataUsage('1');
    await interceptors.rejected!({
      config: { url: 'https://airalo.test/api/v2/sims/1/usage' },
      response: { status: 401 },
    }).catch(() => undefined);
    await service.getDataUsage('2');
    expect(
      http.post.mock.calls.filter(([u]) => String(u).endsWith('/v2/token')),
    ).toHaveLength(2);
  });

  it('should pause background calls after a 429, as long as Retry-After says', async () => {
    const { service, interceptors } = make();
    expect(service.isRateLimited()).toBe(false);
    await interceptors.rejected!({
      config: { url: 'https://airalo.test/api/v2/orders-async' },
      response: { status: 429, headers: { 'retry-after': '90' } },
    }).catch(() => undefined);
    expect(service.isRateLimited()).toBe(true);
    expect(service.isRateLimited(Date.now() + 91_000)).toBe(false);
  });

  it('should ignore answers from other suppliers', async () => {
    const { service, interceptors } = make();
    await interceptors.rejected!({
      config: { url: 'https://other.test/x' },
      response: { status: 429 },
    }).catch(() => undefined);
    expect(service.isRateLimited()).toBe(false);
  });
});
