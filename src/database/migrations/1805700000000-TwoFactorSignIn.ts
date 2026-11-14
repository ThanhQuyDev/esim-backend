import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Đăng nhập 2 lớp bằng OTP" (vande-1411 #005): on or off per account, the
 * hash of the sign-in challenge (looked up), the hash of its code, and the
 * code that switches it off. Never the codes themselves.
 */
export class TwoFactorSignIn1805700000000 implements MigrationInterface {
  name = 'TwoFactorSignIn1805700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
        ADD COLUMN IF NOT EXISTS "twoFactorEnabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "twoFactorChallengeHash" varchar(64),
        ADD COLUMN IF NOT EXISTS "twoFactorCodeHash" varchar(255),
        ADD COLUMN IF NOT EXISTS "twoFactorExpiresAt" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "twoFactorAttempts" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "twoFactorDisableCodeHash" varchar(255),
        ADD COLUMN IF NOT EXISTS "twoFactorDisableExpiresAt" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "twoFactorDisableAttempts" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_two_factor_challenge"
         ON "user" ("twoFactorChallengeHash")
        WHERE "twoFactorChallengeHash" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_two_factor_challenge"`,
    );
    await queryRunner.query(`
      ALTER TABLE "user"
        DROP COLUMN IF EXISTS "twoFactorDisableAttempts",
        DROP COLUMN IF EXISTS "twoFactorDisableExpiresAt",
        DROP COLUMN IF EXISTS "twoFactorDisableCodeHash",
        DROP COLUMN IF EXISTS "twoFactorAttempts",
        DROP COLUMN IF EXISTS "twoFactorExpiresAt",
        DROP COLUMN IF EXISTS "twoFactorCodeHash",
        DROP COLUMN IF EXISTS "twoFactorChallengeHash",
        DROP COLUMN IF EXISTS "twoFactorEnabled"
    `);
  }
}
