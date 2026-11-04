import { derivedExpiry } from './daily-cycle';
import { daysGainedByTopup } from '../topup/billion-addon';

/**
 * The packages on one eSIM, as the customer and the CMS read them (vande-0411
 * #020): the one bought first, then each top-up or add-on, every one with its
 * own dates and price. A top-up runs after what came before it; an add-on only
 * adds data, so it ends with the package it was bought on.
 */
export type EsimPackageStatus = 'active' | 'waiting' | 'expired' | 'processing';

export type EsimPackage = {
  kind: 'initial' | 'topup' | 'addon';
  orderId: number | null;
  orderNumber: string | null;
  name: string | null;
  dataText: string | null;
  isUnlimited: boolean;
  /** Its allowance is per day, so the data reads "1 GB/ngày". */
  perDay: boolean;
  durationDays: number | null;
  status: EsimPackageStatus;
  createdAt: Date | string | null;
  activatedAt: Date | string | null;
  expiresAt: Date | string | null;
  vndPrice: number | null;
};

export type EsimPackagesInput = {
  plan?: {
    name?: string | null;
    standardName?: string | null;
    type?: string | null;
    dataMb?: number | string | null;
    durationDays?: number | string | null;
    dailyResetPolicy?: string | null;
    dailyResetUtcOffset?: number | string | null;
  } | null;
  chosenDays?: number | null;
  activatedAt?: Date | string | null;
  expiresAt?: Date | string | null;
  createdAt?: Date | string | null;
  baseLine?: {
    orderId: number | null;
    orderNumber: string | null;
    vndPrice: number | null;
    createdAt: Date | string | null;
  } | null;
  /** Newest first, as the repository gives them. */
  topups: {
    orderId: number;
    orderNumber: string;
    packageId: string | null;
    packageName: string | null;
    dataText: string | null;
    durationDays: number | null;
    isUnlimited: boolean;
    vndPrice: number;
    status?: string | null;
    createdAt: Date | string;
  }[];
};

const DAY_MS = 86_400_000;

function dataText(mb: number): string | null {
  if (!(mb > 0)) return null;
  if (mb < 1024) return `${mb} MB`;
  return `${Math.round((mb / 1024) * 100) / 100} GB`;
}

function statusOf(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
  now: Date,
): EsimPackageStatus {
  if (!start) return 'waiting';
  if (end && new Date(end).getTime() <= now.getTime()) return 'expired';
  return new Date(start).getTime() > now.getTime() ? 'waiting' : 'active';
}

export function buildEsimPackages(
  input: EsimPackagesInput,
  now: Date = new Date(),
): EsimPackage[] {
  const plan = input.plan ?? null;
  const planDays = input.chosenDays ?? (Number(plan?.durationDays) || null);
  const type = plan?.type ?? 'fixed';
  const baseEnd =
    derivedExpiry(
      input.activatedAt,
      planDays,
      plan?.dailyResetPolicy,
      plan?.dailyResetUtcOffset != null
        ? Number(plan.dailyResetUtcOffset)
        : null,
    ) ?? null;

  const initial: EsimPackage = {
    kind: 'initial',
    orderId: input.baseLine?.orderId ?? null,
    orderNumber: input.baseLine?.orderNumber ?? null,
    name: plan?.standardName || plan?.name || null,
    dataText: dataText(Number(plan?.dataMb) || 0),
    isUnlimited: type !== 'fixed' && type !== 'daily',
    perDay: type === 'daily',
    durationDays: planDays,
    status: 'waiting',
    createdAt: input.baseLine?.createdAt ?? input.createdAt ?? null,
    activatedAt: input.activatedAt ?? null,
    expiresAt: baseEnd,
    vndPrice: input.baseLine?.vndPrice ?? null,
  };

  let cursor: number | null = baseEnd?.getTime() ?? null;
  let lastExtending: EsimPackage = initial;
  const later = [...input.topups]
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .map((topup): EsimPackage => {
      const days = daysGainedByTopup(topup.packageId, topup.durationDays);
      const common = {
        orderId: topup.orderId,
        orderNumber: topup.orderNumber,
        name: topup.packageName || topup.packageId,
        dataText: topup.dataText,
        isUnlimited: topup.isUnlimited,
        perDay: false,
        createdAt: topup.createdAt,
        vndPrice: topup.vndPrice,
      };
      const kind = days ? 'topup' : 'addon';
      const done = (topup.status ?? 'completed') === 'completed';
      if (!done) {
        return {
          ...common,
          kind,
          durationDays: days,
          status: 'processing',
          activatedAt: null,
          expiresAt: null,
        };
      }
      const bought = new Date(topup.createdAt).getTime();
      if (!days) {
        // Data only: the date stays what it was when it was bought.
        const end = cursor === null ? null : new Date(cursor);
        const start = input.activatedAt ? topup.createdAt : null;
        return {
          ...common,
          kind,
          durationDays: null,
          status: statusOf(start, end, now),
          activatedAt: start,
          expiresAt: end,
        };
      }
      if (cursor === null) {
        // Not switched on yet: its clock has not started.
        return {
          ...common,
          kind,
          durationDays: days,
          status: 'waiting',
          activatedAt: null,
          expiresAt: null,
        };
      }
      const start = new Date(Math.max(cursor, bought));
      const end = new Date(start.getTime() + days * DAY_MS);
      cursor = end.getTime();
      const pkg: EsimPackage = {
        ...common,
        kind,
        durationDays: days,
        status: statusOf(start, end, now),
        activatedAt: start,
        expiresAt: end,
      };
      lastExtending = pkg;
      return pkg;
    });

  // The eSIM's own date has the last word, so the package list and the card
  // above it agree: a supplier's date, or a top-up made under the old rule.
  const stored = input.expiresAt ? new Date(input.expiresAt) : null;
  const startedAt = lastExtending.activatedAt
    ? new Date(lastExtending.activatedAt).getTime()
    : null;
  if (stored && (startedAt === null || stored.getTime() > startedAt)) {
    lastExtending.expiresAt = stored;
  }
  initial.status = statusOf(initial.activatedAt, initial.expiresAt, now);
  if (lastExtending !== initial) {
    lastExtending.status = statusOf(
      lastExtending.activatedAt,
      lastExtending.expiresAt,
      now,
    );
  }
  return [initial, ...later];
}
