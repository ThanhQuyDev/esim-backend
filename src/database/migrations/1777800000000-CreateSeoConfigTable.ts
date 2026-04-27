import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSeoConfigTable1777800000000 implements MigrationInterface {
  name = 'CreateSeoConfigTable1777800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "seo_config" (
        "id" SERIAL NOT NULL,
        "url" character varying NOT NULL,
        "metaTitle" character varying,
        "metaDescription" text,
        "metaKeywords" character varying,
        "ogImage" character varying,
        "ogTitle" character varying,
        "ogDescription" text,
        "destinationId" integer,
        "regionId" integer,
        "planId" integer,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_seo_config" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_seo_config_url" ON "seo_config" ("url")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_seo_config_isActive" ON "seo_config" ("isActive")
    `);

    await queryRunner.query(`
      ALTER TABLE "seo_config"
        ADD CONSTRAINT "FK_seo_config_destination"
        FOREIGN KEY ("destinationId") REFERENCES "destination"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "seo_config"
        ADD CONSTRAINT "FK_seo_config_region"
        FOREIGN KEY ("regionId") REFERENCES "region"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "seo_config"
        ADD CONSTRAINT "FK_seo_config_plan"
        FOREIGN KEY ("planId") REFERENCES "plan"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "seo_config" DROP CONSTRAINT "FK_seo_config_plan"`,
    );
    await queryRunner.query(
      `ALTER TABLE "seo_config" DROP CONSTRAINT "FK_seo_config_region"`,
    );
    await queryRunner.query(
      `ALTER TABLE "seo_config" DROP CONSTRAINT "FK_seo_config_destination"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_seo_config_isActive"`);
    await queryRunner.query(`DROP INDEX "IDX_seo_config_url"`);
    await queryRunner.query(`DROP TABLE "seo_config"`);
  }
}
