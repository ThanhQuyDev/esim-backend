import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "eSIM Type: Travel/Local" on destinations and regions (vande-1411 #025). A
 * local destination names a domestic supplier ("vietnamobile-noidia") and
 * gives its carrier page a title, picture, icon and description. Every
 * existing row is travel, so nothing moves.
 */
export class DestinationEsimType1806200000000 implements MigrationInterface {
  name = 'DestinationEsimType1806200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "destination"
         ADD COLUMN IF NOT EXISTS "esimType" varchar(16) NOT NULL DEFAULT 'travel',
         ADD COLUMN IF NOT EXISTS "localProvider" varchar(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "region"
         ADD COLUMN IF NOT EXISTS "esimType" varchar(16) NOT NULL DEFAULT 'travel'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "region" DROP COLUMN IF EXISTS "esimType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "destination"
         DROP COLUMN IF EXISTS "localProvider",
         DROP COLUMN IF EXISTS "esimType"`,
    );
  }
}
