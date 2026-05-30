import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFixedAmountVndToProfitMarginTier1780300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profit_margin_tier" ADD COLUMN "fixedAmountVnd" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profit_margin_tier" DROP COLUMN "fixedAmountVnd"`,
    );
  }
}
