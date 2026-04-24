import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOtpTable1776900000000 implements MigrationInterface {
  name = 'CreateOtpTable1776900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "otp" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "otpHash" character varying NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_otp_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_otp_userId" ON "otp" ("userId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "otp"
      ADD CONSTRAINT "FK_otp_userId"
      FOREIGN KEY ("userId") REFERENCES "user"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "otp" DROP CONSTRAINT "FK_otp_userId"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_otp_userId"`);
    await queryRunner.query(`DROP TABLE "otp"`);
  }
}
