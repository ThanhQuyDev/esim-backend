import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `PartnerLinkEntity.status` is a `PartnerLinkStatusEnum` ('active'|'inactive')
 * and the service filters every link query on it, but
 * CreatePartnerTables1788023400000 created the column as a boolean `isActive`.
 * TypeORM therefore failed with `column PartnerLinkEntity.status does not exist`
 * on every read and write — creating a link, listing links, click tracking and
 * order attribution were all dead, which takes out the whole KOL feature.
 *
 * The boolean is converted rather than dropped so any rows created before this
 * keep their meaning.
 */
export class FixPartnerLinkStatusColumn1788024000000 implements MigrationInterface {
  name = 'FixPartnerLinkStatusColumn1788024000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasStatus = await this.hasColumn(queryRunner, 'status');
    if (hasStatus) return;

    await queryRunner.query(
      `ALTER TABLE "partner_link" ADD COLUMN "status" character varying NOT NULL DEFAULT 'active'`,
    );

    if (await this.hasColumn(queryRunner, 'isActive')) {
      await queryRunner.query(
        `UPDATE "partner_link" SET "status" = CASE WHEN "isActive" THEN 'active' ELSE 'inactive' END`,
      );
      await queryRunner.query(
        `ALTER TABLE "partner_link" DROP COLUMN "isActive"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.hasColumn(queryRunner, 'isActive')) return;

    await queryRunner.query(
      `ALTER TABLE "partner_link" ADD COLUMN "isActive" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `UPDATE "partner_link" SET "isActive" = ("status" = 'active')`,
    );
    await queryRunner.query(`ALTER TABLE "partner_link" DROP COLUMN "status"`);
  }

  private async hasColumn(
    queryRunner: QueryRunner,
    column: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'partner_link' AND column_name = $1`,
      [column],
    );
    return rows.length > 0;
  }
}
