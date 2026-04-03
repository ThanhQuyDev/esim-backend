import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDestination1743696000000 implements MigrationInterface {
  name = 'CreateDestination1743696000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "destination" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "slug" character varying NOT NULL, "countryCode" character varying(2) NOT NULL, "continent" character varying NOT NULL, "region" character varying, "flagUrl" character varying, "avatarUrl" character varying, "keySearch" character varying, "isPopular" boolean NOT NULL DEFAULT false, "isActive" boolean NOT NULL DEFAULT true, "description" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_destination_slug" UNIQUE ("slug"), CONSTRAINT "PK_destination" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_destination_name" ON "destination" ("name")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_destination_countryCode" ON "destination" ("countryCode")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_destination_continent" ON "destination" ("continent")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_destination_isPopular" ON "destination" ("isPopular")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_destination_isActive" ON "destination" ("isActive")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_destination_isActive"`);
    await queryRunner.query(`DROP INDEX "IDX_destination_isPopular"`);
    await queryRunner.query(`DROP INDEX "IDX_destination_continent"`);
    await queryRunner.query(`DROP INDEX "IDX_destination_countryCode"`);
    await queryRunner.query(`DROP INDEX "IDX_destination_name"`);
    await queryRunner.query(`DROP TABLE "destination"`);
  }
}
