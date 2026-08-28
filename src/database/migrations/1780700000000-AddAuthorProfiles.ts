import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthorProfiles1780700000000 implements MigrationInterface {
  name = 'AddAuthorProfiles1780700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "author_profile" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "avatar" character varying,
        "description" character varying,
        CONSTRAINT "PK_author_profile_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_author_profile_user_id" UNIQUE ("userId"),
        CONSTRAINT "UQ_author_profile_slug" UNIQUE ("slug"),
        CONSTRAINT "FK_author_profile_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_author_profile_slug" ON "author_profile" ("slug")`,
    );
    await queryRunner.query(`ALTER TABLE "blog" ADD "authorProfileId" integer`);
    await queryRunner.query(
      `CREATE INDEX "IDX_blog_author_profile_id" ON "blog" ("authorProfileId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "blog"
      ADD CONSTRAINT "FK_blog_author_profile"
      FOREIGN KEY ("authorProfileId") REFERENCES "author_profile"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blog" DROP CONSTRAINT "FK_blog_author_profile"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_blog_author_profile_id"`);
    await queryRunner.query(`ALTER TABLE "blog" DROP COLUMN "authorProfileId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_author_profile_slug"`);
    await queryRunner.query(`DROP TABLE "author_profile"`);
  }
}
