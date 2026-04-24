import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsKycAndApnToPlan1777219200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "isKyc" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "plan" ADD "apn" character varying`);
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "lastSyncedAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "lastSyncedAt"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "apn"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "isKyc"`);
  }
}
