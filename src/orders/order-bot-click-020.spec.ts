import { OrdersService } from './orders.service';
import { SessionShapeEnum } from '../partners/partners.enum';

/**
 * doitac-3010 #020 — a bot dressed as a browser gets past the redirect, but
 * the score its click was given follows it to the order as "Click nghi bot".
 */
function buildService(botSignals: object | null) {
  const service = Object.create(OrdersService.prototype) as OrdersService;
  Object.assign(service, {
    partnersService: {
      hasOrderFromSameOrigin: jest.fn().mockResolvedValue(false),
      matchPartnerOrigin: jest.fn().mockResolvedValue(null),
      evaluateSessionShape: jest
        .fn()
        .mockResolvedValue(SessionShapeEnum.NATURAL),
      clickBotSignals: jest.fn().mockResolvedValue(botSignals),
    },
  });
  return service as unknown as {
    resolveFraudSignals: (
      ...args: unknown[]
    ) => Promise<{ warning: string | null }>;
  };
}

describe('Order warning for a bot-like click (doitac-3010 #020)', () => {
  it('should mark the order when its click looked like a bot', async () => {
    const service = buildService({ score: 65, flags: ['datacenter_ip'] });
    const result = await service.resolveFraudSignals(
      8,
      'visitor',
      'net1',
      'v1.k0.token',
      'Mozilla/5.0',
    );
    expect(result.warning).toBe('bot_click');
  });

  it('should leave an order through a human-looking click alone', async () => {
    const service = buildService(null);
    const result = await service.resolveFraudSignals(
      8,
      'visitor',
      'net1',
      'v1.k0.token',
      'Mozilla/5.0',
    );
    expect(result.warning).toBeNull();
  });
});
