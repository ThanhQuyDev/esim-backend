import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * An admin's own note on a partner (#056).
 *
 * `notes` is what the applicant wrote about themselves, so an admin reviewing
 * the application had nowhere to record why they approved it, what they asked
 * for, or what to check next time. Writing that into the applicant's own field
 * would overwrite their words with ours.
 */
export class AddAdminNoteToPartner1792200000000 implements MigrationInterface {
  name = 'AddAdminNoteToPartner1792200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" ADD COLUMN IF NOT EXISTS "adminNote" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" DROP COLUMN IF EXISTS "adminNote"`,
    );
  }
}
