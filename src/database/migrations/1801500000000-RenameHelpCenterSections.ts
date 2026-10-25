import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Help Center sections renamed (vande #077), slugs following the new names:
 *
 *  - "Chức năng eSIM / eSIM functions" → "Tính năng eSIM / eSIM features"
 *  - "Cơ bản về eSIM / eSIM basics" → "Kiến thức cơ bản về eSIM / eSIM basics"
 *  - "Sử dụng eSIM esim.vn / Using esim.vn eSIM" → "Sử dụng eSIM / Using your eSIM"
 *
 * Articles store their section's slug in `parent`; those under an old slug
 * move to the new one. The storefront still resolves the old slugs and sends
 * their pages on to the new address. Safe to run again.
 */
const RENAMES: [string, string][] = [
  ['chuc-nang-esim', 'tinh-nang-esim'],
  ['chuc_nang_esim', 'tinh-nang-esim'],
  ['esim-functions', 'esim-features'],
  ['esim_functions', 'esim-features'],
  ['co-ban-ve-esim', 'kien-thuc-co-ban-ve-esim'],
  ['co_ban_ve_esim', 'kien-thuc-co-ban-ve-esim'],
  ['using-esim', 'using-your-esim'],
  ['using_esim', 'using-your-esim'],
];

export class RenameHelpCenterSections1801500000000 implements MigrationInterface {
  name = 'RenameHelpCenterSections1801500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of RENAMES) {
      await queryRunner.query(
        `UPDATE "help_center" SET "parent" = $2 WHERE "parent" = $1`,
        [from, to],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Back to the dashed old slugs; the underscore spellings were never used
    // by the CMS, which saves dashes.
    for (const [from, to] of RENAMES.filter(([f]) => f.includes('-'))) {
      await queryRunner.query(
        `UPDATE "help_center" SET "parent" = $2 WHERE "parent" = $1`,
        [to, from],
      );
    }
  }
}
