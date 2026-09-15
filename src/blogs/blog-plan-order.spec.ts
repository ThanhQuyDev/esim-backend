import { BlogMapper } from './infrastructure/persistence/relational/mappers/blog.mapper';
import { BlogEntity } from './infrastructure/persistence/relational/entities/blog.entity';
import { PlanEntity } from '../plans/infrastructure/persistence/relational/entities/plan.entity';
import { Blog } from './domain/blog';
import { Plan } from '../plans/domain/plan';
import {
  parsePlanOrder,
  serializePlanOrder,
  sortByPlanOrder,
} from './blog-plan-order';

/** #057 — plans in a blog post show in the order the admin typed their ids. */
describe('blog plan order', () => {
  it('should read the stored order, ignoring junk', () => {
    expect(parsePlanOrder(['13660', '9238', '11832'])).toEqual([
      13660, 9238, 11832,
    ]);
    expect(parsePlanOrder('13660, 9238')).toEqual([13660, 9238]);
    expect(parsePlanOrder(['', 'x', '0', '12'])).toEqual([12]);
    expect(parsePlanOrder(null)).toEqual([]);
  });

  it('should store ids in the given order, once each', () => {
    expect(
      serializePlanOrder([{ id: 13660 }, { id: 9238 }, { id: 13660 }]),
    ).toEqual(['13660', '9238']);
    expect(serializePlanOrder([])).toBeNull();
  });

  it('should sort items by the stored order, unknown ones last in their own order', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    expect(sortByPlanOrder(items, [3, 1])?.map((i) => i.id)).toEqual([
      3, 1, 2, 4,
    ]);
    expect(sortByPlanOrder(items, [])?.map((i) => i.id)).toEqual([1, 2, 3, 4]);
  });

  it('should hand a post its plans in the typed order', () => {
    const plan = (id: number) => Object.assign(new PlanEntity(), { id });
    const entity = Object.assign(new BlogEntity(), {
      id: 'blog-1',
      language: 'vi',
      slug: '/bang-gia',
      title: 'Bảng giá',
      content: '',
      planOrder: ['13660', '9238', '11832'],
      // What the join table returns: any order.
      plans: [plan(9238), plan(11832), plan(13660)],
    });

    const blog = BlogMapper.toDomain(entity);

    expect(blog.plans?.map((p) => p.id)).toEqual([13660, 9238, 11832]);
  });

  it('should save the order the plans were given in', () => {
    const toPlan = (id: number) => Object.assign(new Plan(), { id });
    const domain = Object.assign(new Blog(), {
      language: 'vi',
      slug: '/bang-gia',
      title: 'Bảng giá',
      content: '',
      plans: [toPlan(11832), toPlan(13660), toPlan(9238)],
    });

    expect(BlogMapper.toPersistence(domain).planOrder).toEqual([
      '11832',
      '13660',
      '9238',
    ]);
  });
});
