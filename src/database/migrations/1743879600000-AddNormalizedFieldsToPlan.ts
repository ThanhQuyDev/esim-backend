import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorPlanNormalizedFields1743879600000 implements MigrationInterface {
  name = 'RefactorPlanNormalizedFields1743879600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop old columns that are being replaced
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_plan_provider"`);
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "packageId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "dataAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "dataVolumeMB"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "duration"`,
    );
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN IF EXISTS "speed"`);
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "isUnlimited"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "activationType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "operators"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "description"`,
    );
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN IF EXISTS "price"`);
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "currency"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "provider"`,
    );

    // Widen destination.countryCode from varchar(2) to varchar(10)
    await queryRunner.query(
      `ALTER TABLE "destination" ALTER COLUMN "countryCode" TYPE character varying(10)`,
    );

    // Make destinationId nullable (was NOT NULL from original migration)
    await queryRunner.query(
      `ALTER TABLE "plan" ALTER COLUMN "destinationId" DROP NOT NULL`,
    );

    // Add new normalized columns
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "provider" character varying NOT NULL DEFAULT 'esimaccess'`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "providerPlanId" character varying NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "countryCode" character varying(10)`,
    );
    await queryRunner.query(`ALTER TABLE "plan" ADD "regionId" integer`);
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "durationDays" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "dataGb" decimal(10,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "costPrice" decimal(10,4) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "price" decimal(10,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "retailPrice" decimal(10,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "currency" character varying(3) NOT NULL DEFAULT 'USD'`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "type" character varying NOT NULL DEFAULT 'data-in-total'`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "topUp" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "isCheapest" boolean NOT NULL DEFAULT false`,
    );

    // Add indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_plan_provider" ON "plan" ("provider")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_plan_countryCode" ON "plan" ("countryCode")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_plan_regionId" ON "plan" ("regionId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD CONSTRAINT "FK_plan_region" FOREIGN KEY ("regionId") REFERENCES "region"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // Create profit_margin table
    await queryRunner.query(
      `CREATE TABLE "profit_margin" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "percentage" decimal(5,2) NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_profit_margin" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_profit_margin_isActive" ON "profit_margin" ("isActive")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop profit_margin
    await queryRunner.query(`DROP INDEX "IDX_profit_margin_isActive"`);
    await queryRunner.query(`DROP TABLE "profit_margin"`);

    // Drop new indexes and FK
    await queryRunner.query(
      `ALTER TABLE "plan" DROP CONSTRAINT IF EXISTS "FK_plan_region"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_plan_regionId"`);
    await queryRunner.query(`DROP INDEX "IDX_plan_countryCode"`);
    await queryRunner.query(`DROP INDEX "IDX_plan_provider"`);

    // Drop new columns
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "isCheapest"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "topUp"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "type"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "currency"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "retailPrice"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "price"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "costPrice"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "dataGb"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "durationDays"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "regionId"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "countryCode"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "providerPlanId"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "provider"`);

    // Restore old columns
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "dataAmount" character varying NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "duration" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "description" character varying`,
    );
  }
}
