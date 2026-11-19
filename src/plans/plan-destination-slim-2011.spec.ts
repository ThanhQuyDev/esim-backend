import { slimPlanDestination } from './plans.service';

/** vande-2011 #011: a product page's plans no longer carry the whole destination. */
describe('slimPlanDestination (vande-2011 #011)', () => {
  class FakePlan {
    id = 1;
    destination: Record<string, unknown> = {
      id: 9,
      name: 'China',
      slug: 'esim-trung-quoc',
      countryCode: 'CN',
      flagUrl: 'https://x/cn.png',
      parentId: null,
      description: 'x'.repeat(5000),
      notice: 'y'.repeat(2000),
      keySearch: 'trung quoc, china',
      providers: ['gadgetkorea', 'billion'],
    };
    get label() {
      return `plan ${this.id}`;
    }
  }

  it('should keep only what a product page reads, on a copy of the same class', () => {
    const plan = new FakePlan();
    const slim = slimPlanDestination(plan);
    expect(slim).toBeInstanceOf(FakePlan);
    expect(slim.label).toBe('plan 1');
    expect(slim.destination).toEqual({
      id: 9,
      name: 'China',
      slug: 'esim-trung-quoc',
      countryCode: 'CN',
      flagUrl: 'https://x/cn.png',
      parentId: null,
    });
    // The original is left alone.
    expect(plan.destination.description).toHaveLength(5000);
  });

  it('should leave a plan without a destination as it is', () => {
    const plan = { id: 2, destination: null };
    expect(slimPlanDestination(plan)).toBe(plan);
  });
});
