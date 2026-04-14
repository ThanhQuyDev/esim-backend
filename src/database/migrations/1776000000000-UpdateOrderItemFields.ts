import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateOrderItemFields1776000000000 implements MigrationInterface {
  name = 'UpdateOrderItemFields1776000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD "orderRequestId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD "status" character varying NOT NULL DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_item_status" ON "order_item" ("status")`,
    );

    // Drop planPriceId foreign key and column
    const table = await queryRunner.getTable('order_item');
    const fk = table?.foreignKeys.find(
      (f) => f.columnNames.indexOf('planPriceId') !== -1,
    );
    if (fk) {
      await queryRunner.query(
        `ALTER TABLE "order_item" DROP CONSTRAINT "${fk.name}"`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP COLUMN IF EXISTS "planPriceId"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_item_status"`);
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP COLUMN IF EXISTS "status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP COLUMN IF EXISTS "orderRequestId"`,
    );

    // Re-add planPriceId
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD "planPriceId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD CONSTRAINT "FK_order_item_planPriceId" FOREIGN KEY ("planPriceId") REFERENCES "plan_price"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
