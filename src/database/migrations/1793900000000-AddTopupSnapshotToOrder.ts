import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #015 — Record WHAT a topup order bought, at the moment it was bought.
 *
 * A topup order stored only `topupPackageId`, so the order detail page could not
 * say what the customer got (data, days) or what it cost us — `vndCostPrice` was
 * hardcoded to 0. Re-reading the package from the provider at view time is no
 * answer: catalogues change and packages disappear, and an order has to keep
 * reporting the deal it was actually sold.
 */
export class AddTopupSnapshotToOrder1793900000000 implements MigrationInterface {
  name = 'AddTopupSnapshotToOrder1793900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD "topupPackageName" character varying(300)`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "topupDataText" character varying(60)`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "topupDurationDays" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "topupIsUnlimited" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "topupIsUnlimited"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "topupDurationDays"`,
    );
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "topupDataText"`);
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "topupPackageName"`,
    );
  }
}
