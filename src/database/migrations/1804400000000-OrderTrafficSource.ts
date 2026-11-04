import { MigrationInterface, QueryRunner } from 'typeorm';

/** "Nguồn truy cập" on an order (vande-0411 #052). Old orders stay empty. */
export class OrderTrafficSource1804400000000 implements MigrationInterface {
  name = 'OrderTrafficSource1804400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "order"
        ADD COLUMN IF NOT EXISTS "trafficSource" varchar(120),
        ADD COLUMN IF NOT EXISTS "trafficGroup" varchar(20),
        ADD COLUMN IF NOT EXISTS "trafficDetail" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "order"
        DROP COLUMN IF EXISTS "trafficSource",
        DROP COLUMN IF EXISTS "trafficGroup",
        DROP COLUMN IF EXISTS "trafficDetail"`);
  }
}
