import {
  isDefiniteRefusal,
  isDuplicateOrderRefusal,
  MAX_PROVISION_ATTEMPTS,
  nextAutoRetryAt,
  provisionErrorText,
  RETRY_DELAY_MINUTES,
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

  it('should ask again every run of the 5-minute job (vande-0411 #005)', () => {
    expect(RETRY_DELAY_MINUTES).toBeLessThan(5);
    expect(RETRY_DELAY_MINUTES).toBeGreaterThanOrEqual(3);
  });

  it('should schedule the next try of a refused eSIM Access line', () => {
    expect(nextAutoRetryAt(paid, refused, 'esimaccess', NOW)).toEqual(
      new Date('2026-10-25T10:02:00Z'),
    );
  });

  describe('suppliers with no protection against a repeat (vande-0411 #005)', () => {
    const answered = (lastProvisionError: string) => ({
      ...refused,
      lastProvisionError,
    });

    it('should ask Airalo again after its 429, as on ORD-261102234944448-O2QUUF', () => {
      expect(
        nextAutoRetryAt(
          paid,
          answered('Request failed with status code 429'),
          'airalo',
          NOW,
        ),
      ).toEqual(new Date('2026-10-25T10:02:00Z'));
    });

    it('should ask the others again when they answered no', () => {
      for (const [supplier, error] of [
        ['gadgetkorea', 'Request failed with status code 400'],
        ['microesim', 'MicroEsim API error: 500 - no stock'],
        ['billion', 'BILLION F040 error: 1001 - busy'],
      ]) {
        expect(
          nextAutoRetryAt(paid, answered(error), supplier, NOW),
        ).not.toBeNull();
      }
    });

    it('should never repeat a try that may have bought the eSIM', () => {
      for (const error of [
        'timeout of 30000ms exceeded',
        'socket hang up',
        'read ECONNRESET',
        'Request failed with status code 500',
        'Request failed with status code 502',
        'Request failed with status code 408',
      ]) {
        expect(isDefiniteRefusal(error)).toBe(false);
        expect(
          nextAutoRetryAt(paid, answered(error), 'airalo', NOW),
        ).toBeNull();
      }
    });

    it('should not touch a line whose first try is still running', () => {
      expect(
        nextAutoRetryAt(
          paid,
          {
            orderRequestId: null,
            provisionAttempts: 0,
            lastProvisionError: null,
            lastProvisionAttemptAt: null,
          },
          'airalo',
          NOW,
        ),
      ).toBeNull();
    });

    it('should stop on a duplicate refusal, even as a 4xx', () => {
      expect(
        nextAutoRetryAt(
          paid,
          answered('Request failed with status code 409 duplicate order'),
          'gadgetkorea',
          NOW,
        ),
      ).toBeNull();
    });

    it('should leave a supplier it does not know alone', () => {
      expect(
        nextAutoRetryAt(
          paid,
          answered('Request failed with status code 429'),
          'viettel',
          NOW,
        ),
      ).toBeNull();
    });
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
