import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBlogFaqsTable1778600000000 implements MigrationInterface {
  name = 'CreateBlogFaqsTable1778600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add url column to faq table
    await queryRunner.query(`ALTER TABLE "faq" ADD "url" character varying`);

    // Add language column to help_center table
    await queryRunner.query(
      `ALTER TABLE "help_center" ADD "language" character varying`,
    );

    // Create blog_faqs join table
    await queryRunner.query(
      `CREATE TABLE "blog_faqs" (
        "blogId" uuid NOT NULL,
        "faqId" uuid NOT NULL,
        CONSTRAINT "PK_blog_faqs" PRIMARY KEY ("blogId", "faqId")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_blog_faqs_blogId" ON "blog_faqs" ("blogId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_blog_faqs_faqId" ON "blog_faqs" ("faqId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "blog_faqs" ADD CONSTRAINT "FK_blog_faqs_blogId" FOREIGN KEY ("blogId") REFERENCES "blog"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "blog_faqs" ADD CONSTRAINT "FK_blog_faqs_faqId" FOREIGN KEY ("faqId") REFERENCES "faq"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blog_faqs" DROP CONSTRAINT "FK_blog_faqs_faqId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "blog_faqs" DROP CONSTRAINT "FK_blog_faqs_blogId"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_blog_faqs_faqId"`);
    await queryRunner.query(`DROP INDEX "IDX_blog_faqs_blogId"`);
    await queryRunner.query(`DROP TABLE "blog_faqs"`);
    await queryRunner.query(`ALTER TABLE "help_center" DROP COLUMN "language"`);
    await queryRunner.query(`ALTER TABLE "faq" DROP COLUMN "url"`);
  }
}
