import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What the suppliers tell us once an eSIM reaches a phone (vande #011): when
 * it was added (downloaded / installed), the phone's EID, and the phone model.
 * The EID settles "I scanned it on the wrong phone" and "my phone is locked"
 * complaints; the install time is the second of the four moments on the eSIM
 * screen (ordered → installed → activated → expires).
 */
export class EsimInstallEidDevice1799600000000 implements MigrationInterface {
  name = 'EsimInstallEidDevice1799600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "esim" ADD COLUMN IF NOT EXISTS "installedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" ADD COLUMN IF NOT EXISTS "eid" varchar(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" ADD COLUMN IF NOT EXISTS "deviceModel" varchar(120)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "esim" DROP COLUMN IF EXISTS "deviceModel"`,
    );
    await queryRunner.query(`ALTER TABLE "esim" DROP COLUMN IF EXISTS "eid"`);
    await queryRunner.query(
      `ALTER TABLE "esim" DROP COLUMN IF EXISTS "installedAt"`,
    );
  }
}
