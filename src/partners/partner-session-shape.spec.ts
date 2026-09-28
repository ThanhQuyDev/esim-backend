import { PartnersService } from './partners.service';
import { SessionEventTypeEnum, SessionShapeEnum } from './partners.enum';

/**
 * The shape of a buying session (#040).
 *
 * A real purchase leaves a trail — a destination opened, a plan or two
 * compared, a cart, then payment. An order scripted through the checkout leaves
 * none of it, and a script driving a browser leaves the opposite tell: twenty
 * plans in ten seconds. The verdict is a mark for an admin; it never refuses an
 * order or withholds a commission, which is what #036 settled.
 */

const at = (msAgo: number) => new Date(Date.now() - msAgo);

function buildService(
  events: { eventType: SessionEventTypeEnum; occurredAt: Date }[],
  opts: { alreadyToday?: number } = {},
) {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  const save = jest.fn().mockResolvedValue(undefined);
  Object.assign(service, {
    sessionEventRepository: {
      find: jest.fn().mockResolvedValue(events),
      count: jest.fn().mockResolvedValue(opts.alreadyToday ?? 0),
      create: jest.fn().mockImplementation((row) => row),
      save,
    },
  });
  return { service, save };
}

const planViews = (count: number, spacingMs: number) =>
  Array.from({ length: count }, (_, i) => ({
    eventType: SessionEventTypeEnum.PLAN_VIEW,
    occurredAt: at(count * spacingMs - i * spacingMs),
  }));

describe('PartnersService.evaluateSessionShape (#040)', () => {
  it('should call a browse-compare-buy session natural', async () => {
    const { service } = buildService([
      { eventType: SessionEventTypeEnum.PLAN_LIST, occurredAt: at(120_000) },
      { eventType: SessionEventTypeEnum.PLAN_VIEW, occurredAt: at(90_000) },
      { eventType: SessionEventTypeEnum.PLAN_VIEW, occurredAt: at(60_000) },
      { eventType: SessionEventTypeEnum.ADD_TO_CART, occurredAt: at(30_000) },
      {
        eventType: SessionEventTypeEnum.CHECKOUT_START,
        occurredAt: at(10_000),
      },
    ]);

    await expect(
      service.evaluateSessionShape({ visitorId: 'visitor-1' }),
    ).resolves.toBe(SessionShapeEnum.NATURAL);
  });

  it('should mark an order that jumped straight to payment', async () => {
    const { service } = buildService([
      {
        eventType: SessionEventTypeEnum.CHECKOUT_START,
        occurredAt: at(5_000),
      },
    ]);

    await expect(
      service.evaluateSessionShape({ visitorId: 'visitor-1' }),
    ).resolves.toBe(SessionShapeEnum.NO_BROWSING);
  });

  it('should mark a session with no steps at all', async () => {
    const { service } = buildService([]);

    await expect(
      service.evaluateSessionShape({ visitorId: 'visitor-1' }),
    ).resolves.toBe(SessionShapeEnum.NO_BROWSING);
  });

  it('should mark twenty plans read in ten seconds', async () => {
    // 20 views half a second apart: no person reads that fast.
    const { service } = buildService(planViews(20, 500));

    await expect(
      service.evaluateSessionShape({ visitorId: 'visitor-1' }),
    ).resolves.toBe(SessionShapeEnum.INHUMAN_SPEED);
  });

  it('should leave a patient shopper alone', async () => {
    // The same 20 plans, a minute apart — somebody genuinely comparing.
    const { service } = buildService(planViews(20, 60_000));

    await expect(
      service.evaluateSessionShape({ visitorId: 'visitor-1' }),
    ).resolves.toBe(SessionShapeEnum.NATURAL);
  });

  it('should have no verdict when there is no session to look up', async () => {
    const { service } = buildService([]);

    await expect(service.evaluateSessionShape({})).resolves.toBeNull();
    await expect(
      service.evaluateSessionShape({ visitorId: '  ', clickId: null }),
    ).resolves.toBeNull();
  });

  it('should judge a session by its click id when the visitor id is missing', async () => {
    const { service } = buildService([
      { eventType: SessionEventTypeEnum.PLAN_VIEW, occurredAt: at(30_000) },
    ]);

    await expect(
      service.evaluateSessionShape({ clickId: 'a'.repeat(32) }),
    ).resolves.toBe(SessionShapeEnum.NATURAL);
  });
});

describe('PartnersService.recordSessionEvents (#040)', () => {
  it('should store the steps it recognises', async () => {
    const { service, save } = buildService([]);

    await expect(
      service.recordSessionEvents({
        visitorId: 'visitor-1',
        events: [
          { type: 'plan_view', ref: 'japan-7d' },
          { type: 'add_to_cart' },
        ],
      }),
    ).resolves.toEqual({ recorded: 2 });

    const rows = save.mock.calls[0][0] as {
      eventType: string;
      ref?: unknown;
    }[];
    expect(rows.map((row) => row.eventType)).toEqual([
      'plan_view',
      'add_to_cart',
    ]);
    expect(rows[0].ref).toBe('japan-7d');
  });

  it('should drop a step name it does not know', async () => {
    const { service, save } = buildService([]);

    await expect(
      service.recordSessionEvents({
        visitorId: 'visitor-1',
        events: [{ type: 'admin_login' }, { type: 'DROP TABLE' }],
      }),
    ).resolves.toEqual({ recorded: 0 });
    expect(save).not.toHaveBeenCalled();
  });

  it('should refuse a report that belongs to no session', async () => {
    const { service, save } = buildService([]);

    await expect(
      service.recordSessionEvents({ events: [{ type: 'plan_view' }] }),
    ).resolves.toEqual({ recorded: 0 });
    expect(save).not.toHaveBeenCalled();
  });

  it('should cap one batch so a script cannot flood the table', async () => {
    const { service, save } = buildService([]);

    const result = await service.recordSessionEvents({
      visitorId: 'visitor-1',
      events: Array.from({ length: 100 }, () => ({ type: 'plan_view' })),
    });

    expect(result.recorded).toBe(20);
    expect((save.mock.calls[0][0] as unknown[]).length).toBe(20);
  });

  it('should stop once the visitor has filed a day’s worth', async () => {
    const { service, save } = buildService([], { alreadyToday: 600 });

    await expect(
      service.recordSessionEvents({
        visitorId: 'visitor-1',
        events: [{ type: 'plan_view' }],
      }),
    ).resolves.toEqual({ recorded: 0 });
    expect(save).not.toHaveBeenCalled();
  });

  it('should record only what is left of the daily allowance', async () => {
    const { service } = buildService([], { alreadyToday: 597 });

    await expect(
      service.recordSessionEvents({
        visitorId: 'visitor-1',
        events: Array.from({ length: 10 }, () => ({ type: 'plan_view' })),
      }),
    ).resolves.toEqual({ recorded: 3 });
  });
});
