import { billionTimeToIso, billionUsageResult } from './billion-usage';

/**
 * eSIM Billion không cập nhật dung lượng / kích hoạt / hết hạn (vande #004).
 * Dữ liệu thật trả về từ F046 cho ICCID 89812003919133192668 (beta, 25/10).
 */
const REAL_SUB = {
  subOrderId: '1792406316517913',
  channelSubOrderId: 'MAN-261019173835885-FIQ9V7-bl-84',
  skuId: '1785911405932332',
  skuName: 'Vietnam-1GB/Natural day+eSIM Carrier of 90 days ',
  copies: '1',
  planStatus: '2',
  planStartTime: '2026-10-19 18:44:49',
  planEndTime: '2026-10-20 00:00:00',
  totalDays: '1',
  totalTraffic: '-1',
  highFlowSize: '1048576',
  planType: '1',
  usageInfoList: [{ usedDate: '20261019', usageAmt: '1051625' }],
};

describe('Dung lượng eSIM Billion (vande #004)', () => {
  it('should read Billion times as UTC+8', () => {
    expect(billionTimeToIso('2026-10-19 18:44:49')).toBe(
      '2026-10-19T10:44:49.000Z',
    );
    expect(billionTimeToIso('')).toBeNull();
    expect(billionTimeToIso('garbage')).toBeNull();
  });

  it('should report a daily plan against its high-speed allowance', () => {
    const r = billionUsageResult(REAL_SUB);
    expect(r.total).toBe(1024);
    expect(r.dataUsed).toBeCloseTo(1026.98, 1);
    expect(r.remaining).toBe(0);
    expect(r.isUnlimited).toBe(false);
    expect(r.status).toBe('FINISHED');
    expect(r.activatedAt).toBe('2026-10-19T10:44:49.000Z');
    expect(r.expiredAt).toBe('2026-10-19T16:00:00.000Z');
    expect(r.durationDays).toBe(1);
  });

  it('should multiply the daily allowance by the days', () => {
    const r = billionUsageResult({ ...REAL_SUB, totalDays: '7' });
    expect(r.total).toBe(7 * 1024);
  });

  it('should keep a total-quota plan at its total', () => {
    const r = billionUsageResult({
      ...REAL_SUB,
      planType: '0',
      totalTraffic: '5242880',
      planStatus: '1',
    });
    expect(r.total).toBe(5120);
    expect(r.status).toBe('ACTIVE');
  });

  it('should call a plan with no allowance at all unlimited', () => {
    const r = billionUsageResult({
      ...REAL_SUB,
      highFlowSize: '-1',
      totalTraffic: '-1',
    });
    expect(r.isUnlimited).toBe(true);
    expect(r.remaining).toBeNull();
  });

  it('should say "not activated" before the plan starts', () => {
    const r = billionUsageResult({
      ...REAL_SUB,
      planStatus: '0',
      planStartTime: '',
      usageInfoList: [],
    });
    expect(r.status).toBe('NOT_ACTIVE');
    expect(r.activatedAt).toBeNull();
    expect(r.dataUsed).toBe(0);
  });
});

describe('Lấy dung lượng Billion qua EsimsService (vande #004)', () => {
  it('should ask Billion with the order id of the line the eSIM was sold on', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EsimsService } = require('./esims.service');
    const service = Object.create(EsimsService.prototype);
    const updates: Record<string, unknown>[] = [];
    const esim = {
      id: 237,
      iccid: '89812003919133192668',
      provider: 'billion',
      status: 'sold',
      activatedAt: null,
      expiresAt: null,
      dataUsed: '0',
      dataTotal: '1GB',
    };
    service.esimsRepository = {
      // The relation loader does not carry the order line: the id must come
      // from findOrderRequestId, not from `orderItem`.
      findByIdWithRelations: jest.fn().mockResolvedValue({ ...esim }),
      findOrderRequestId: jest.fn().mockResolvedValue('2792406316509912'),
      update: jest.fn((_id: unknown, patch: Record<string, unknown>) => {
        updates.push(patch);
        return Promise.resolve(esim);
      }),
    };
    const getUsage = jest.fn().mockResolvedValue({ subOrderList: [REAL_SUB] });
    service.billionService = { getUsage };

    const result = await service.fetchProviderUsage(esim);

    expect(getUsage).toHaveBeenCalledWith(
      '2792406316509912',
      '89812003919133192668',
    );
    expect(result.status).toBe('FINISHED');
    expect(updates[0].activatedAt).toEqual(new Date('2026-10-19T10:44:49Z'));
    expect(updates[0].expiresAt).toEqual(new Date('2026-10-19T16:00:00Z'));
    expect(Number(updates[0].dataUsed)).toBeCloseTo(1026.98, 1);
  });
});
