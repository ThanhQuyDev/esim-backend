import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackendFeaturesPart61778300000000 implements MigrationInterface {
  name = 'BackendFeaturesPart61778300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Feature 1.1: Create tickets table
    await queryRunner.query(`
      CREATE TABLE "ticket" (
        "id" SERIAL NOT NULL,
        "customerEmail" character varying NOT NULL,
        "subject" character varying NOT NULL,
        "description" text NOT NULL,
        "orderId" character varying,
        "deviceModel" character varying,
        "iccid" character varying,
        "planDestination" character varying,
        "attachments" jsonb,
        "status" character varying NOT NULL DEFAULT 'open',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ticket" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_ticket_customerEmail" ON "ticket" ("customerEmail")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ticket_status" ON "ticket" ("status")`,
    );

    // Feature 2.1: Add type column to why_choose_us
    await queryRunner.query(
      `ALTER TABLE "why_choose_us" ADD "type" character varying`,
    );

    // Feature 3.2: Add tags column to plan
    await queryRunner.query(`ALTER TABLE "plan" ADD "tags" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert Feature 3.2
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "tags"`);

    // Revert Feature 2.1
    await queryRunner.query(`ALTER TABLE "why_choose_us" DROP COLUMN "type"`);

    // Revert Feature 1.1
    await queryRunner.query(`DROP INDEX "IDX_ticket_status"`);
    await queryRunner.query(`DROP INDEX "IDX_ticket_customerEmail"`);
    await queryRunner.query(`DROP TABLE "ticket"`);
  }
}
