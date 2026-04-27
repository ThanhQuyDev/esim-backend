import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsLocalInventoryToPlan1777600000000 implements MigrationInterface {
  name = 'AddIsLocalInventoryToPlan1777600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "isLocalInventory" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "isLocalInventory"`,
    );
  }
}
