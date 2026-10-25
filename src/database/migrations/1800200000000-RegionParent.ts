import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Khu vực cha" on the region (vande #035).
 *
 * Until now the storefront guessed which regions share one page from their
 * Vietnamese title with a trailing country count removed ("Châu Á 13 Quốc
 * Gia" + "Châu Á 7 Quốc Gia" → "Châu Á"). The admin now picks the parent. The
 * backfill writes the guess down as parents, so nothing on the website moves
 * on deploy and the admin sees — and can correct — today's grouping.
 *
 * In each group the parent is the region whose slug is the group's own page
 * slug (the shared slug prefix, e.g. `esim-chau-a`), else the one with the
 * fewest countries — the pack the storefront lists first.
 */
export class RegionParent1800200000000 implements MigrationInterface {
  name = 'RegionParent1800200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "region" ADD COLUMN IF NOT EXISTS "parentId" integer`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_region_parentId" ON "region" ("parentId")`,
    );

    const rows: Array<{
      id: number;
      name: string;
      titleVi: string | null;
      slug: string;
      slugVi: string | null;
      parentId: number | null;
      count: string;
    }> = await queryRunner.query(`
      SELECT r.id, r.name, r."titleVi", r.slug, r."slugVi", r."parentId",
             (SELECT COUNT(*) FROM destination_region dr WHERE dr."regionId" = r.id) AS count
      FROM region r
      WHERE r."deletedAt" IS NULL
      ORDER BY r.id
    `);
    if (rows.some((r) => r.parentId !== null)) return; // already set by hand

    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = groupKey(row.titleVi || row.name);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    for (const members of groups.values()) {
      if (members.length < 2) continue;
      const slugs = members.map((m) => m.slugVi || m.slug);
      const pageSlug = sharedPrefix(slugs);
      const parent =
        members.find((m) => (m.slugVi || m.slug) === pageSlug) ??
        [...members].sort(
          (a, b) => Number(a.count) - Number(b.count) || a.id - b.id,
        )[0];
      const children = members
        .filter((m) => m.id !== parent.id)
        .map((m) => m.id);
      await queryRunner.query(
        `UPDATE "region" SET "parentId" = $1 WHERE id = ANY($2::int[])`,
        [parent.id, children],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_region_parentId"`);
    await queryRunner.query(
      `ALTER TABLE "region" DROP COLUMN IF EXISTS "parentId"`,
    );
  }
}

/** The storefront's old rule (lib/region-groups.ts `regionGroupKey`). */
function groupKey(title: string): string {
  const normalized = (title || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const stripped = normalized
    .replace(
      /[\s\-–—(]*\d+\s*(?:quoc gia|nuoc|countries|country)\s*\)?\s*$/,
      '',
    )
    .trim();
  return stripped || normalized;
}

/** Slug segments every slug starts with (lib/region-groups.ts `regionGroupSlug`). */
function sharedPrefix(slugs: string[]): string {
  const parts = slugs.map((s) => s.split('-'));
  const shared: string[] = [];
  for (let i = 0; i < parts[0].length; i++) {
    if (parts.every((p) => p[i] === parts[0][i])) shared.push(parts[0][i]);
    else break;
  }
  return shared.join('-');
}
