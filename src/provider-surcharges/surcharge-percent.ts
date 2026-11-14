/**
 * The supplier's tax/fee ("thuế phí", #049) as a factor on its cost, for the
 * cost an order keeps (vande-1411 #006). One table read per order.
 *
 * Supplier names come spelled two ways — `gadgetkorea` on a plan and in the
 * surcharge table, `GADGET_KOREA` on a topup — so both are reduced to the
 * same key.
 */
export function surchargeKey(provider: string | null | undefined): string {
  return String(provider ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export type SurchargePercents = Map<string, number>;

export async function loadSurchargePercents(
  dataSource?: {
    query: (sql: string) => Promise<unknown>;
  } | null,
): Promise<SurchargePercents> {
  if (!dataSource) return new Map();
  try {
    const rows = (await dataSource.query(
      `SELECT "provider", "percentage" FROM "provider_surcharge"`,
    )) as { provider: string; percentage: string | number }[];
    return new Map(
      (rows ?? []).map((r) => [
        surchargeKey(r.provider),
        Number(r.percentage) || 0,
      ]),
    );
  } catch {
    // No table to read (a test, an old database): cost as quoted.
    return new Map();
  }
}

/** 1.2 for a supplier charged 20% on top; 1 when none is set. */
export function surchargeFactor(
  percents: SurchargePercents,
  provider: string | null | undefined,
): number {
  return 1 + (percents.get(surchargeKey(provider)) ?? 0) / 100;
}
