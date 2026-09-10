import { REFERRAL_BLOCKING_ORDER_STATUSES } from './wallets.service';

describe('Referral first-order eligibility', () => {
  it('should treat paid orders as a prior purchase', () => {
    expect(REFERRAL_BLOCKING_ORDER_STATUSES).toContain('paid');
  });

  it('should also block buyers whose order moved past paid', () => {
    // A returning buyer whose order is `completed` or `refunded` has still
    // purchased before, so the first-order-only referral must be refused.
    expect(REFERRAL_BLOCKING_ORDER_STATUSES).toContain('completed');
    expect(REFERRAL_BLOCKING_ORDER_STATUSES).toContain('refunded');
  });

  it('should not block a buyer whose only order is still pending or failed', () => {
    expect(REFERRAL_BLOCKING_ORDER_STATUSES).not.toContain('pending');
    expect(REFERRAL_BLOCKING_ORDER_STATUSES).not.toContain('failed');
    expect(REFERRAL_BLOCKING_ORDER_STATUSES).not.toContain('cancelled');
  });
});
