import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFupSpeedToPlan1776674714897 implements MigrationInterface {
  name = 'AddFupSpeedToPlan1776674714897';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_region_isPopular"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_order_item_status"`,
    );
    await queryRunner.query(`ALTER TABLE "region" DROP COLUMN "isPopular"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "sms"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "call"`);
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "fupSpeed" character varying`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6afe58c75949b10364ee133435" ON "order_item" ("status") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6afe58c75949b10364ee133435"`,
    );
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "fupSpeed"`);
    await queryRunner.query(`ALTER TABLE "plan" ADD "call" integer`);
    await queryRunner.query(`ALTER TABLE "plan" ADD "sms" integer`);
    await queryRunner.query(
      `ALTER TABLE "region" ADD "isPopular" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_item_status" ON "order_item" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_region_isPopular" ON "region" ("isPopular") `,
    );
  }
}
