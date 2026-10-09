import { withSuccessfulTopups } from './infrastructure/persistence/relational/repositories/order.repository';

describe('order list status filter (#022, test round 4)', () => {
  it('should include topups that went through when filtering paid', () => {
    expect(withSuccessfulTopups('paid')).toEqual(['paid', 'completed']);
    expect(withSuccessfulTopups(['paid', 'refunded'])).toEqual([
      'paid',
      'refunded',
      'completed',
    ]);
  });

  it('should leave every other filter as it is', () => {
    expect(withSuccessfulTopups('failed')).toEqual(['failed']);
    expect(withSuccessfulTopups(['paid', 'completed'])).toEqual([
      'paid',
      'completed',
    ]);
  });
});
