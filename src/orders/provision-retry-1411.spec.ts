import {
  isRateLimited,
  nextAutoRetryAt,
  provisionErrorText,
  retryAfterSeconds,
  retryDelaySeconds,
  retryStaggerMs,
} from './provision-retry';

/**
 * vande-1411 #001: the retry used to wait a round 4 minutes for every line, so
 * two eSIMs refused together with a 429 were asked again at the same second and
 * the rate limit refused one of them each time (10 eSIMs ≈ 40 minutes).
 */
describe('Lịch gọi lại nhà cung cấp (vande-1411 #001)', () => {
  const NOW = new Date('2026-11-08T04:00:03Z');
  const paid = { status: 'paid', createdAt: new Date('2026-11-08T03:59:00Z') };
  const refused = (id: number, attempts = 1) => ({
    id,
    orderRequestId: null,
    provisionAttempts: attempts,
    lastProvisionError: 'Request failed with status code 429',
    lastProvisionAttemptAt: NOW,
  });

  it('should ask again 1 to 4 minutes after the failed try', () => {
    for (let id = 1; id <= 500; id++) {
      const wait = retryDelaySeconds(id, 1 + (id % 12));
      expect(wait).toBeGreaterThanOrEqual(60);
      expect(wait).toBeLessThanOrEqual(240);
    }
  });

  it('should not ask again for lines refused together at the same moment', () => {
    const times = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110].map((id) =>
      nextAutoRetryAt(paid, refused(id), 'airalo', NOW)!.getTime(),
    );
    expect(new Set(times).size).toBeGreaterThanOrEqual(8);
  });

  it('should show the admin the same time the job will use', () => {
    const a = nextAutoRetryAt(paid, refused(678), 'airalo', NOW);
    const b = nextAutoRetryAt(paid, refused(678), 'airalo', NOW);
    expect(a).toEqual(b);
  });

  it('should wait as long as the supplier asks with Retry-After', () => {
    const err = Object.assign(
      new Error('Request failed with status code 429'),
      { response: { status: 429, headers: { 'retry-after': '600' } } },
    );
    const text = provisionErrorText(err);
    expect(text).toBe(
      'Request failed with status code 429 (Retry-After: 600s)',
    );
    expect(retryAfterSeconds(text)).toBe(600);
    expect(isRateLimited(text)).toBe(true);
    const next = nextAutoRetryAt(
      paid,
      { ...refused(678), lastProvisionError: text },
      'airalo',
      NOW,
    );
    expect(next!.getTime() - NOW.getTime()).toBe(600_000);
  });

  it('should leave the message alone without a Retry-After', () => {
    expect(
      provisionErrorText(new Error('Request failed with status code 429')),
    ).toBe('Request failed with status code 429');
  });

  it('should space the calls of one run 10 to 20 seconds apart', () => {
    expect(retryStaggerMs(() => 0)).toBe(10_000);
    expect(retryStaggerMs(() => 1)).toBe(20_000);
    expect(retryStaggerMs(() => 0.5)).toBe(15_000);
  });
});

describe('Dòng đã hoàn tiền (vande-1411 #001)', () => {
  it('should not promise a retry for a line that is no longer pending', () => {
    const NOW = new Date('2026-11-08T04:00:03Z');
    const paid = { status: 'paid', createdAt: NOW };
    const line = {
      id: 77,
      orderRequestId: null,
      provisionAttempts: 1,
      lastProvisionError: 'Request failed with status code 429',
      lastProvisionAttemptAt: NOW,
    };
    for (const status of ['refunded', 'failed', 'cancelled', 'completed']) {
      expect(
        nextAutoRetryAt(paid, { ...line, status }, 'airalo', NOW),
      ).toBeNull();
    }
    expect(
      nextAutoRetryAt(paid, { ...line, status: 'pending' }, 'airalo', NOW),
    ).not.toBeNull();
  });
});
