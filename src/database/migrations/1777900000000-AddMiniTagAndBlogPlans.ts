import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMiniTagAndBlogPlans1777900000000 implements MigrationInterface {
  name = 'AddMiniTagAndBlogPlans1777900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "mini_tag" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "image" character varying, "title" character varying NOT NULL, "description" character varying, "contentButton" character varying, "linkUrl" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_mini_tag" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE TABLE "blog_plans" ("blogId" uuid NOT NULL, "planId" integer NOT NULL, CONSTRAINT "PK_blog_plans" PRIMARY KEY ("blogId", "planId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_blog_plans_blogId" ON "blog_plans" ("blogId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_blog_plans_planId" ON "blog_plans" ("planId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "blog" ADD "category" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "blog" ADD "miniTagId" uuid`);

    await queryRunner.query(
      `ALTER TABLE "blog" ADD CONSTRAINT "FK_blog_miniTagId" FOREIGN KEY ("miniTagId") REFERENCES "mini_tag"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "blog_plans" ADD CONSTRAINT "FK_blog_plans_blogId" FOREIGN KEY ("blogId") REFERENCES "blog"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "blog_plans" ADD CONSTRAINT "FK_blog_plans_planId" FOREIGN KEY ("planId") REFERENCES "plan"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blog_plans" DROP CONSTRAINT "FK_blog_plans_planId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "blog_plans" DROP CONSTRAINT "FK_blog_plans_blogId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "blog" DROP CONSTRAINT "FK_blog_miniTagId"`,
    );
    await queryRunner.query(`ALTER TABLE "blog" DROP COLUMN "miniTagId"`);
    await queryRunner.query(`ALTER TABLE "blog" DROP COLUMN "category"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_blog_plans_planId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_blog_plans_blogId"`);
    await queryRunner.query(`DROP TABLE "blog_plans"`);
    await queryRunner.query(`DROP TABLE "mini_tag"`);
  }
}
