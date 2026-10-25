import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Roles ticked on top of a user's main one (vande #071): an admin who also
 * writes articles, an author who also buys on the storefront. Empty for
 * everybody to begin with, so nothing changes until an admin ticks one.
 */
export class UserExtraRoles1801200000000 implements MigrationInterface {
  name = 'UserExtraRoles1801200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "extraRoleIds" integer array NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "extraRoleIds"`,
    );
  }
}
