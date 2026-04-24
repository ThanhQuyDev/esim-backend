import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLastSyncedAtToPlan1777219300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "lastSyncedAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "lastSyncedAt"`);
  }
}
