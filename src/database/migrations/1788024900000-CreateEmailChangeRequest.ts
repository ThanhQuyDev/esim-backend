import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets a customer change their own email address (#057).
 *
 * The new address has to be proved before it replaces the old one: login is
 * email + OTP, so switching to a mistyped address would lock the customer out of
 * their own eSIMs permanently. A pending change therefore lives here until the
 * code sent to the NEW address comes back.
 *
 * Deliberately separate from the `otp` table: that one is the login code, and a
 * login code must never be usable to take over someone's email (or the reverse).
 */
export class CreateEmailChangeRequest1788024900000 implements MigrationInterface {
  name = 'CreateEmailChangeRequest1788024900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_change_request" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "newEmail" character varying(255) NOT NULL,
        "codeHash" character varying(255) NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_change_request" PRIMARY KEY ("id")
      )
    `);

    // One pending change per customer: asking again replaces the previous code.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_email_change_request_user" ON "email_change_request" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_change_request" ADD CONSTRAINT "FK_email_change_request_user"
       FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "email_change_request" DROP CONSTRAINT IF EXISTS "FK_email_change_request_user"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_email_change_request_user"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "email_change_request"`);
  }
}
