import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHotSpotToPlan1778200000000 implements MigrationInterface {
  name = 'AddHotSpotToPlan1778200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "hotSpot" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "hotSpotAllow" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "hotSpotAllow"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "hotSpot"`);
  }
}
