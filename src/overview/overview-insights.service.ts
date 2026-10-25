import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { countryName, ipPlace } from '../orders/buyer-location';
import { deviceInfo } from '../utils/device-info';
import {
  COMPLETED_ORDER_ITEM_STATUSES,
  OverviewDateRangeQueryDto,
} from './dto/overview.dto';
import {
  itemNetRevenueSql,
  itemPartnerCommissionSql,
  vietnamBoundaryFromInput,
  vietnamDayRangeUtc,
} from './overview.service';

/**
 * The five KPI cards and the audience charts of Tổng quan (vande #059).
 *
 * "Web" means what customers buy on the storefront — directly, through a
 * marketing partner's link, or ordered for them by an admin — and never what
 * a distribution or API partner buys from their wallet at the partner price
 * (`partner_wallet`), which is wholesale, not sales.
 *
 * Visits come from `site_visit`: one row per browser per Vietnamese day,
 * reported by the storefront. Nothing was recorded before this, so the
 * conversion rate and the visit charts start empty.
 */

const WEB_ORDER = `o."deletedAt" IS NULL AND o."paymentMethod" IS DISTINCT FROM 'partner_wallet'`;
const PAID = `o.status = 'paid'`;
const COUNTED_ITEM = `oi.status IN (${COMPLETED_ORDER_ITEM_STATUSES.map((s) => `'${s}'`).join(', ')})`;

const BOT =
  /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|curl|wget|python-requests/i;

type Range = { from: string | null; to: string | null };

const n = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Same periods as the rest of Tổng quan, as UTC instants. */
export function overviewRange(query: OverviewDateRangeQueryDto): Range {
  const now = new Date();
  const day = (offset: number) => vietnamDayRangeUtc(now, offset);
  const iso = (d: Date) => d.toISOString();
  switch (query.preset) {
    case 'today':
      return { from: iso(day(0).from), to: iso(day(0).to) };
    case 'yesterday':
      return { from: iso(day(-1).from), to: iso(day(-1).to) };
    case 'last7days':
      return { from: iso(day(-6).from), to: iso(day(0).to) };
    case 'last30days':
      return { from: iso(day(-29).from), to: iso(day(0).to) };
  }
  return {
    from: query.from
      ? vietnamBoundaryFromInput(query.from, 'start').toISOString()
      : null,
    to: query.to
      ? vietnamBoundaryFromInput(query.to, 'end').toISOString()
      : null,
  };
}

/** `column` within the range; the ISO strings carry their zone. */
function inRange(column: string, from: string, to: string): string {
  return `($${from}::timestamptz IS NULL OR ${column} >= $${from}::timestamptz)
      AND ($${to}::timestamptz IS NULL OR ${column} <= $${to}::timestamptz)`;
}

/** `order."createdAt"` is a UTC wall time without a zone. */
function orderInRange(from: string, to: string): string {
  return inRange(`(o."createdAt" AT TIME ZONE 'UTC')`, from, to);
}

@Injectable()
export class OverviewInsightsService {
  private readonly logger = new Logger(OverviewInsightsService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * A visit from the storefront: at most one row per browser per Vietnamese
   * day. The address only finds the city; it is not kept. Bots are ignored.
   */
  async recordVisit(input: {
    visitorId: string;
    userAgent: string | null;
    ip: string | null;
  }): Promise<{ recorded: boolean }> {
    const ua = input.userAgent ?? '';
    if (!ua.trim() || BOT.test(ua)) return { recorded: false };
    const device = deviceInfo(ua);
    const place = await ipPlace(input.ip);
    const os = device.os?.replace(/ \d+$/, '') ?? null;
    try {
      const rows: unknown[] = await this.dataSource.query(
        `INSERT INTO site_visit ("visitorId", day, "deviceType", os, country, city, "isNew")
         VALUES ($1::varchar, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, $2, $3, $4, $5,
                 NOT EXISTS (SELECT 1 FROM site_visit WHERE "visitorId" = $1::varchar))
         ON CONFLICT ("visitorId", day) DO NOTHING
         RETURNING id`,
        [
          input.visitorId,
          device.type,
          os,
          place?.country ?? null,
          place?.city?.slice(0, 80) ?? null,
        ],
      );
      return { recorded: rows.length > 0 };
    } catch (err) {
      this.logger.warn(`recordVisit: ${(err as Error).message}`);
      return { recorded: false };
    }
  }

  /** The five KPI cards (vande #059). */
  async getKpis(query: OverviewDateRangeQueryDto) {
    const range = overviewRange(query);
    const params = [range.from, range.to];
    const q = async (sql: string, extra: unknown[] = []) =>
      (
        (await this.dataSource.query(sql, [...params, ...extra])) as Record<
          string,
          unknown
        >[]
      )[0] ?? {};

    const [money, orders, visits, partners, payouts, users] = await Promise.all(
      [
        // 1. Revenue of what was delivered, after refunds and discounts.
        q(`SELECT COALESCE(SUM(${itemNetRevenueSql('o', 'oi')}), 0) AS revenue,
                  COALESCE(SUM(oi."vndCostPrice"), 0) AS cost,
                  COALESCE(SUM(${itemPartnerCommissionSql('o', 'oi')}), 0) AS commission,
                  COALESCE(SUM(oi.quantity), 0) AS plans
             FROM "order" o JOIN order_item oi ON oi."orderId" = o.id
            WHERE ${WEB_ORDER} AND ${PAID} AND ${COUNTED_ITEM}
              AND ${orderInRange('1', '2')}`),
        // 2. Orders (eSIM and top-up), eSIMs handed out, failed orders.
        q(`SELECT COUNT(*) FILTER (WHERE ${PAID}) AS paid,
                  COUNT(*) FILTER (WHERE o.status = 'failed') AS failed,
                  COUNT(*) FILTER (WHERE ${PAID} AND o."paymentMethod" IS DISTINCT FROM 'admin_manual') AS "selfPaid",
                  (SELECT COUNT(*) FROM esim e JOIN order_item ei ON ei.id = e."orderItemId"
                     JOIN "order" eo ON eo.id = ei."orderId"
                    WHERE e."deletedAt" IS NULL AND eo.status = 'paid'
                      AND eo."deletedAt" IS NULL
                      AND eo."paymentMethod" IS DISTINCT FROM 'partner_wallet'
                      AND ${inRange(`(eo."createdAt" AT TIME ZONE 'UTC')`, '1', '2')}) AS esims
             FROM "order" o
            WHERE ${WEB_ORDER} AND ${orderInRange('1', '2')}`),
        q(`SELECT COUNT(*) AS visits FROM site_visit v
            WHERE ${inRange('v."createdAt"', '1', '2')}`),
        // 3. Partners — now, not over the period.
        this.dataSource
          .query(
            `SELECT COUNT(*) FILTER (WHERE status = 'active') AS active,
                    COUNT(*) FILTER (WHERE status = 'active' AND "partnerType" = 'kol') AS kol,
                    COUNT(*) FILTER (WHERE status = 'active' AND "partnerType" = 'distribution') AS distribution,
                    COUNT(*) FILTER (WHERE status = 'pending') AS pending
               FROM partner WHERE "deletedAt" IS NULL`,
          )
          .then((rows: Record<string, unknown>[]) => rows[0] ?? {}),
        // 4. Money waiting to go out to partners — now.
        this.dataSource
          .query(
            `WITH reserved AS (
               SELECT "partnerId", SUM("amountVnd") AS amount
                 FROM partner_payout WHERE status IN ('pending', 'approved')
                GROUP BY "partnerId"
             )
             SELECT
               COALESCE((SELECT SUM(amount) FROM reserved), 0) AS "payoutPending",
               (SELECT COUNT(*) FROM reserved) AS "payoutPartners",
               COALESCE((SELECT SUM("commissionVnd") FROM order_partner_commission
                          WHERE status = 'pending'), 0) AS "commissionPending",
               COALESCE(SUM(GREATEST(w."balanceVnd" - COALESCE(r.amount, 0), 0))
                 FILTER (WHERE p."partnerType" = 'kol'), 0) AS "commissionAvailable",
               COALESCE(SUM(GREATEST(w."balanceVnd" - COALESCE(r.amount, 0), 0))
                 FILTER (WHERE p."partnerType" = 'distribution' AND NOT p."noDepositRequired"), 0)
                 AS "depositAvailable"
             FROM partner p
             JOIN partner_wallet w ON w."partnerId" = p.id
             LEFT JOIN reserved r ON r."partnerId" = p.id
             WHERE p."deletedAt" IS NULL`,
          )
          .then((rows: Record<string, unknown>[]) => rows[0] ?? {}),
        // 5. Customers who opened an account in the period.
        q(`SELECT COUNT(*) AS "newUsers" FROM "user" u
            WHERE u."deletedAt" IS NULL AND u."roleId" = 2
              AND ${inRange(`(u."createdAt" AT TIME ZONE 'UTC')`, '1', '2')}`),
      ],
    );

    const revenue = Math.round(n(money.revenue));
    const cost = Math.round(n(money.cost));
    const commission = Math.round(n(money.commission));
    const visitCount = n(visits.visits);
    const selfPaid = n(orders.selfPaid);
    return {
      revenue: {
        netRevenueVnd: revenue,
        costVnd: cost,
        partnerCommissionVnd: commission,
        grossProfitVnd: revenue - cost - commission,
      },
      orders: {
        paidOrders: n(orders.paid),
        esimsSold: n(orders.esims),
        visits: visitCount,
        /** Orders a customer paid themselves ÷ visits; null without visits. */
        conversionPercent: visitCount
          ? Math.round((selfPaid / visitCount) * 1000) / 10
          : null,
      },
      partners: {
        active: n(partners.active),
        kol: n(partners.kol),
        distribution: n(partners.distribution),
        pending: n(partners.pending),
      },
      payouts: {
        pendingVnd: Math.round(n(payouts.payoutPending)),
        pendingPartners: n(payouts.payoutPartners),
        commissionPendingVnd: Math.round(n(payouts.commissionPending)),
        commissionAvailableVnd: Math.round(n(payouts.commissionAvailable)),
        depositAvailableVnd: Math.round(n(payouts.depositAvailable)),
      },
      customers: {
        newUsers: n(users.newUsers),
        plansSold: n(money.plans),
        failedOrders: n(orders.failed),
      },
    };
  }

  /**
   * Who comes and who buys (vande #059): visits and paid web orders by
   * device, by new or returning, and visitors by country and city.
   *
   * A visitor is new on the first day their browser is ever seen; an order is
   * new when it is the customer's first paid web order.
   */
  async getAudience(query: OverviewDateRangeQueryDto) {
    const range = overviewRange(query);
    const params = [range.from, range.to];
    const visitRange = inRange('v."createdAt"', '1', '2');

    const [visitDevices, orderDevices, visitKinds, orderKinds, places] =
      await Promise.all([
        this.dataSource.query(
          `SELECT COALESCE(v."deviceType", 'unknown') AS key, COUNT(*) AS n
             FROM site_visit v WHERE ${visitRange} GROUP BY 1`,
          params,
        ),
        this.dataSource.query(
          `SELECT COALESCE(o."deviceType", 'unknown') AS key, COUNT(*) AS n
             FROM "order" o
            WHERE ${WEB_ORDER} AND ${PAID} AND ${orderInRange('1', '2')}
            GROUP BY 1`,
          params,
        ),
        this.dataSource.query(
          `SELECT CASE WHEN v."isNew" THEN 'new' ELSE 'returning' END AS key,
                  COUNT(*) AS n
             FROM site_visit v WHERE ${visitRange} GROUP BY 1`,
          params,
        ),
        this.dataSource.query(
          `SELECT CASE WHEN EXISTS (
                    SELECT 1 FROM "order" prior
                     WHERE prior."userId" = o."userId" AND prior.status = 'paid'
                       AND prior."deletedAt" IS NULL
                       AND prior."paymentMethod" IS DISTINCT FROM 'partner_wallet'
                       AND prior."createdAt" < o."createdAt")
                  THEN 'returning' ELSE 'new' END AS key,
                  COUNT(*) AS n
             FROM "order" o
            WHERE ${WEB_ORDER} AND ${PAID} AND ${orderInRange('1', '2')}
            GROUP BY 1`,
          params,
        ),
        this.dataSource.query(
          `SELECT v.country, v.city, COUNT(DISTINCT v."visitorId") AS visitors
             FROM site_visit v
            WHERE ${visitRange} AND v.country IS NOT NULL
            GROUP BY 1, 2`,
          params,
        ),
      ]);

    const toMap = (rows: { key: string; n: unknown }[]) =>
      new Map(rows.map((r) => [String(r.key), n(r.n)]));
    const vd = toMap(visitDevices);
    const od = toMap(orderDevices);
    const devices = ['desktop', 'mobile', 'tablet', 'unknown']
      .map((key) => ({
        deviceType: key,
        visits: vd.get(key) ?? 0,
        orders: od.get(key) ?? 0,
      }))
      .filter((d) => d.deviceType !== 'unknown' || d.visits || d.orders);

    const vk = toMap(visitKinds);
    const ok = toMap(orderKinds);
    const customers = (['new', 'returning'] as const).map((key) => ({
      kind: key,
      visits: vk.get(key) ?? 0,
      orders: ok.get(key) ?? 0,
    }));

    // Visitors by country, each with its cities; a visitor in two cities of
    // one country counts once for the country.
    const byCountry = new Map<
      string,
      { visitors: number; cities: Map<string, number> }
    >();
    for (const row of places as {
      country: string;
      city: string | null;
      visitors: unknown;
    }[]) {
      const entry = byCountry.get(row.country) ?? {
        visitors: 0,
        cities: new Map<string, number>(),
      };
      entry.cities.set(
        row.city ?? '',
        (entry.cities.get(row.city ?? '') ?? 0) + n(row.visitors),
      );
      byCountry.set(row.country, entry);
    }
    const [countryTotals] = (await this.dataSource.query(
      `SELECT COUNT(DISTINCT v."visitorId") AS total
         FROM site_visit v WHERE ${visitRange}`,
      params,
    )) as { total: unknown }[];
    const perCountry: Record<string, number> = Object.fromEntries(
      (
        (await this.dataSource.query(
          `SELECT v.country, COUNT(DISTINCT v."visitorId") AS n
             FROM site_visit v WHERE ${visitRange} AND v.country IS NOT NULL
            GROUP BY 1`,
          params,
        )) as { country: string; n: unknown }[]
      ).map((r) => [r.country, n(r.n)]),
    );
    const total = n(countryTotals?.total);
    const pct = (value: number, of: number) =>
      of ? Math.round((value / of) * 1000) / 10 : 0;
    const countries = [...byCountry.entries()]
      .map(([code, entry]) => {
        const visitors = perCountry[code] ?? entry.visitors;
        return {
          country: code,
          name: countryName(code, 'vi'),
          visitors,
          percent: pct(visitors, total),
          cities: [...entry.cities.entries()]
            .map(([city, count]) => ({
              city: city || 'Không rõ thành phố',
              visitors: count,
              percent: pct(count, visitors),
            }))
            .sort((a, b) => b.visitors - a.visitors),
        };
      })
      .sort((a, b) => b.visitors - a.visitors);

    return { totalVisitors: total, devices, customers, countries };
  }
}
