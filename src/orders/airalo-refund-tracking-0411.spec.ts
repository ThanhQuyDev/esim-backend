import { OrdersService } from './orders.service';
import { airaloRefundOutcome } from '../esim-providers/airalo/airalo-refund';
import {
  afterSaleFromF020,
  afterSaleNote,
} from '../esim-providers/billion/billion-after-sale';

/** vande-0411 #009 — following a refund request after it was sent. */
const ROW = {
  id: 1,
  refundId: 'R1',
  orderId: 7,
  iccids: 'A',
  airaloOrderIds: '123',
  statusText: null,
};

function build(slug: string | null) {
  const service = Object.create(OrdersService.prototype) as OrdersService;
  const query = jest.fn((sql: string) =>
    Promise.resolve(sql.startsWith('SELECT') ? [ROW] : []),
  );
  Object.assign(service, {
    dataSource: { query },
    airaloService: {
      getOrderStatus: jest.fn().mockResolvedValue({ name: slug, slug }),
    },
    logger: { warn: jest.fn(), error: jest.fn() },
  });
  return { service, query };
}

describe('Theo dõi yêu cầu hoàn tiền (vande-0411 #009)', () => {
  it('should read the status words without guessing', () => {
    expect(airaloRefundOutcome('completed')).toBe('pending');
    expect(airaloRefundOutcome(null)).toBe('pending');
    expect(airaloRefundOutcome('refunded')).toBe('refunded');
    expect(airaloRefundOutcome('Partially_Refunded')).toBe('refunded');
    expect(airaloRefundOutcome('cancelled')).toBe('changed');
  });

  it('should write nothing while Airalo still says completed', async () => {
    const { service, query } = build('completed');

    await service.refreshAiraloRefundRequests();

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('should note a refund on the order and close the request', async () => {
    const { service, query } = build('refunded');

    await service.refreshAiraloRefundRequests();

    const calls = query.mock.calls as unknown as [string, unknown[]][];
    expect(calls[1][1]).toEqual([1, 'refunded', 'refunded']);
    expect(String(calls[2][1][1])).toContain('Airalo đã hoàn tiền');
  });

  it('should keep following a status it does not know, and say so', async () => {
    const { service, query } = build('cancelled');

    await service.refreshAiraloRefundRequests();

    const calls = query.mock.calls as unknown as [string, unknown[]][];
    expect(calls[1][1]).toEqual([1, 'pending', 'cancelled']);
    expect(String(calls[2][1][1])).toContain('kiểm tra trên trang Airalo');
  });

  it("should state Billion's refunded amount when a read gives it", () => {
    const update = afterSaleFromF020({
      refundStatus: '1',
      refundAmount: '12.5',
    });

    expect(afterSaleNote('9', 'A', update)).toContain('số tiền 12.5');
  });
});
