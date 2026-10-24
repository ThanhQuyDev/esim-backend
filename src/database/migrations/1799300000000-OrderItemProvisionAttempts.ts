import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What the supplier said when asked for a paid line (vande #003): how many
 * times it was asked, its last refusal and when. A refusal used to vanish into
 * the log and leave the order "paid, no eSIM" with nothing in the CMS saying
 * why; it now shows on the order and drives the automatic retry.
 */
export class OrderItemProvisionAttempts1799300000000 implements MigrationInterface {
  name = 'OrderItemProvisionAttempts1799300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "provisionAttempts" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "lastProvisionError" varchar(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "lastProvisionAttemptAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP COLUMN IF EXISTS "lastProvisionAttemptAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP COLUMN IF EXISTS "lastProvisionError"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP COLUMN IF EXISTS "provisionAttempts"`,
    );
  }
}
