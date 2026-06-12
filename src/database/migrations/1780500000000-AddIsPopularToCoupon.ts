import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsPopularToCoupon1780500000000 implements MigrationInterface {
  name = 'AddIsPopularToCoupon1780500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "coupon" ADD "isPopular" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_coupon_isPopular" ON "coupon" ("isPopular")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_coupon_isPopular"`);
    await queryRunner.query(`ALTER TABLE "coupon" DROP COLUMN "isPopular"`);
  }
}
