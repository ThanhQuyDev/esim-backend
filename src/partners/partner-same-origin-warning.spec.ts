import { PartnersService } from './partners.service';
import { hashIpForFraudWatch } from '../orders/order-fraud-signals';

/**
 * Several affiliate orders from one device or one network (#036).
 *
 * One person buying through their own link over and over looks exactly like
 * this. The brief is explicit that the order still earns its commission — what
 * it gets is a mark, so an admin reviewing that partner can see the pattern.
 */

function buildService(found: boolean) {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  const query = jest.fn().mockResolvedValue(found ? [{ '?column?': 1 }] : []);
  Object.assign(service, { dataSource: { query } });
  return { service, query };
}

describe('PartnersService — orders from the same origin (#036)', () => {
  it('should report a repeat from the same device', async () => {
    const { service, query } = buildService(true);

    await expect(
      service.hasOrderFromSameOrigin(8, 'visitor-1', 'ip-hash'),
    ).resolves.toBe(true);

    const [partnerId, visitorId, ipHash] = query.mock.calls[0][1] as unknown[];
    expect([partnerId, visitorId, ipHash]).toEqual([8, 'visitor-1', 'ip-hash']);
  });

  it('should say no when this partner has not seen the origin before', async () => {
    const { service } = buildService(false);

    await expect(
      service.hasOrderFromSameOrigin(8, 'visitor-1', 'ip-hash'),
    ).resolves.toBe(false);
  });

  it('should not query at all when there is nothing to compare', async () => {
    const { service, query } = buildService(false);

    await expect(service.hasOrderFromSameOrigin(8, null, null)).resolves.toBe(
      false,
    );
    expect(query).not.toHaveBeenCalled();
  });
});

describe('hashIpForFraudWatch (#036)', () => {
  it('should be stable for the same address and different for another', () => {
    const first = hashIpForFraudWatch('203.0.113.9');

    expect(first).toBe(hashIpForFraudWatch(' 203.0.113.9 '));
    expect(first).not.toBe(hashIpForFraudWatch('203.0.113.10'));
    // Never the address itself: this is a comparison key, not a location log.
    expect(first).not.toContain('203.0.113');
  });

  it('should have nothing to say about a missing address', () => {
    expect(hashIpForFraudWatch(null)).toBeNull();
    expect(hashIpForFraudWatch('unknown')).toBeNull();
    expect(hashIpForFraudWatch('   ')).toBeNull();
  });
});
