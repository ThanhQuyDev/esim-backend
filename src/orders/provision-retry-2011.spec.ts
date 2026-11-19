import {
  autoRetryStopReason,
  isDefiniteRefusal,
  isNeverSent,
  MAX_PROVISION_ATTEMPTS,
  nextAutoRetryAt,
} from './provision-retry';

/**
 * vande-2011 #001: a Gadget Korea line that failed with a DNS error
 * (`getaddrinfo EAI_AGAIN open-api.usimsa.com`) was left for a person after
 * one try. A call that never reached the supplier bought nothing, so every
 * supplier is asked again for it.
 */
describe('provision retry for calls that never reached the supplier (vande-2011 #001)', () => {
  const now = new Date('2026-11-20T10:00:00Z');
  const order = { status: 'paid', createdAt: new Date('2026-11-20T09:50:00Z') };
  const line = (error: string, attempts = 1) => ({
    id: 77,
    status: 'pending',
    orderRequestId: null,
    provisionAttempts: attempts,
    lastProvisionError: error,
    lastProvisionAttemptAt: new Date('2026-11-20T09:50:00Z'),
  });

  it.each([
    'getaddrinfo EAI_AGAIN open-api.usimsa.com',
    'getaddrinfo ENOTFOUND api.airalo.com',
    'connect ECONNREFUSED 1.2.3.4:443',
    'connect EHOSTUNREACH 1.2.3.4:443',
    'Request failed with status code 503',
  ])('should treat "%s" as never sent', (error) => {
    expect(isNeverSent(error)).toBe(true);
    expect(isDefiniteRefusal(error)).toBe(true);
  });

  it.each([
    'timeout of 30000ms exceeded',
    'read ECONNRESET',
    'Request failed with status code 500',
    'Request failed with status code 504',
  ])('should treat "%s" as maybe sent', (error) => {
    expect(isNeverSent(error)).toBe(false);
    expect(isDefiniteRefusal(error)).toBe(false);
  });

  it.each(['gadgetkorea', 'airalo', 'billion', 'microesim', 'esimaccess'])(
    'should ask %s again after a DNS failure',
    (provider) => {
      const item = line('getaddrinfo EAI_AGAIN open-api.usimsa.com');
      expect(nextAutoRetryAt(order, item, provider, now)).not.toBeNull();
      expect(autoRetryStopReason(order, item, provider, now)).toBeNull();
    },
  );

  it('should say why it stopped', () => {
    expect(
      autoRetryStopReason(
        order,
        line('timeout of 30000ms exceeded'),
        'gadgetkorea',
        now,
      ),
    ).toBe('unsure');
    expect(
      autoRetryStopReason(
        order,
        line('Request failed with status code 429', MAX_PROVISION_ATTEMPTS),
        'airalo',
        now,
      ),
    ).toBe('attempts');
    expect(
      autoRetryStopReason(
        { status: 'paid', createdAt: new Date('2026-11-18T09:00:00Z') },
        line('Request failed with status code 429'),
        'airalo',
        now,
      ),
    ).toBe('window');
    expect(
      autoRetryStopReason(
        order,
        line('transactionId already exists'),
        'esimaccess',
        now,
      ),
    ).toBe('duplicate');
  });
});
