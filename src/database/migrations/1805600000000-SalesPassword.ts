import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Mật khẩu bán hàng" (vande-1411 #004): a second password an admin or a
 * partner types before any transaction that moves money. Kept as a bcrypt
 * hash, with a count of wrong tries and a lock, and the hash of the emailed
 * code that sets or resets it. Never the password or the code itself.
 */
export class SalesPassword1805600000000 implements MigrationInterface {
  name = 'SalesPassword1805600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
        ADD COLUMN IF NOT EXISTS "salesPasswordHash" varchar(255),
        ADD COLUMN IF NOT EXISTS "salesPasswordSetAt" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "salesPasswordFailedCount" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "salesPasswordLockedUntil" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "salesPasswordCodeHash" varchar(255),
        ADD COLUMN IF NOT EXISTS "salesPasswordCodeExpiresAt" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "salesPasswordCodeAttempts" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
        DROP COLUMN IF EXISTS "salesPasswordCodeAttempts",
        DROP COLUMN IF EXISTS "salesPasswordCodeExpiresAt",
        DROP COLUMN IF EXISTS "salesPasswordCodeHash",
        DROP COLUMN IF EXISTS "salesPasswordLockedUntil",
        DROP COLUMN IF EXISTS "salesPasswordFailedCount",
        DROP COLUMN IF EXISTS "salesPasswordSetAt",
        DROP COLUMN IF EXISTS "salesPasswordHash"
    `);
  }
}
