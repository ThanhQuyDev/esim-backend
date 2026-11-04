import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * When the supplier was last asked about an eSIM's usage (vande-0411 #029).
 * The refresh took the eSIMs with the oldest `updatedAt`, but a save that
 * changes nothing leaves `updatedAt` alone: with more eSIMs due than one run
 * takes, the unchanged ones stayed in front and the rest waited.
 */
export class EsimUsageCheckedAt1803900000000 implements MigrationInterface {
  name = 'EsimUsageCheckedAt1803900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "esim" ADD COLUMN IF NOT EXISTS "usageCheckedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_esim_usageCheckedAt" ON "esim" ("usageCheckedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_esim_usageCheckedAt"`);
    await queryRunner.query(
      `ALTER TABLE "esim" DROP COLUMN IF EXISTS "usageCheckedAt"`,
    );
  }
}
