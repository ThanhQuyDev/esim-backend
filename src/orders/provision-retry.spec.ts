import {
  isDuplicateOrderRefusal,
  MAX_PROVISION_ATTEMPTS,
  nextAutoRetryAt,
  provisionErrorText,
  retryDelayMinutes,
} from './provision-retry';

/**
 * Đơn esimaccess bị treo (vande #003): nhà cung cấp từ chối thì lỗi được giữ
 * trên dòng hàng và hệ thống tự gọi lại theo lịch giãn dần.
 */
describe('Tự gọi lại nhà cung cấp cho dòng hàng chưa được nhận (vande #003)', () => {
  const NOW = new Date('2026-10-25T10:00:00Z');
  const paid = { status: 'paid', createdAt: new Date('2026-10-25T09:00:00Z') };
  const refused = {
    orderRequestId: null,
    provisionAttempts: 1,
    lastProvisionError: 'EsimAccess order failed: 200006 - amount is wrong',
    lastProvisionAttemptAt: new Date('2026-10-25T09:58:00Z'),
  };

  it('should wait 5, 15, 30 then 60 minutes between tries', () => {
    expect([1, 2, 3, 4, 9].map(retryDelayMinutes)).toEqual([5, 15, 30, 60, 60]);
  });

  it('should schedule the next try of a refused eSIM Access line', () => {
    expect(nextAutoRetryAt(paid, refused, 'esimaccess', NOW)).toEqual(
      new Date('2026-10-25T10:03:00Z'),
    );
  });

  it('should not retry Airalo on its own (no idempotency key)', () => {
    expect(nextAutoRetryAt(paid, refused, 'airalo', NOW)).toBeNull();
  });

  it('should stop once the supplier took the line, the tries run out, or the order is old or unpaid', () => {
    expect(
      nextAutoRetryAt(
        paid,
        { ...refused, orderRequestId: 'B1' },
        'esimaccess',
        NOW,
      ),
    ).toBeNull();
    expect(
      nextAutoRetryAt(
        paid,
        { ...refused, provisionAttempts: MAX_PROVISION_ATTEMPTS },
        'esimaccess',
        NOW,
      ),
    ).toBeNull();
    expect(
      nextAutoRetryAt(
        { ...paid, createdAt: new Date('2026-10-23T09:00:00Z') },
        refused,
        'esimaccess',
        NOW,
      ),
    ).toBeNull();
    expect(
      nextAutoRetryAt(
        { ...paid, status: 'failed' },
        refused,
        'esimaccess',
        NOW,
      ),
    ).toBeNull();
  });

  it('should stop when the supplier says the order already exists (no second eSIM)', () => {
    const dup = {
      ...refused,
      lastProvisionError: 'transactionId already exists',
    };
    expect(isDuplicateOrderRefusal(dup.lastProvisionError)).toBe(true);
    expect(nextAutoRetryAt(paid, dup, 'esimaccess', NOW)).toBeNull();
    expect(isDuplicateOrderRefusal(refused.lastProvisionError)).toBe(false);
  });

  it('should keep a long supplier message within the column', () => {
    expect(provisionErrorText(new Error('x'.repeat(900)))).toHaveLength(500);
  });
});
