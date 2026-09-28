import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Announcements an admin sends to partners (#079).
 *
 * One row per announcement rather than one per recipient: a message to four
 * hundred partners is one thing that was said, and copying it four hundred
 * times would make editing a typo four hundred writes. Who has read it is a
 * separate, much smaller table — most partners never open most announcements,
 * so the read rows stay sparse.
 */
export class CreatePartnerNotification1793300000000 implements MigrationInterface {
  name = 'CreatePartnerNotification1793300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "partner_notification" (
         "id" SERIAL NOT NULL,
         "title" character varying(200) NOT NULL,
         "body" text NOT NULL,
         "audience" character varying(20) NOT NULL DEFAULT 'all',
         "sendEmail" boolean NOT NULL DEFAULT false,
         "emailsSent" integer NOT NULL DEFAULT 0,
         "createdByAdminId" integer,
         "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
         CONSTRAINT "PK_partner_notification" PRIMARY KEY ("id")
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_partner_notification_createdAt"
         ON "partner_notification" ("createdAt")`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "partner_notification_read" (
         "id" SERIAL NOT NULL,
         "notificationId" integer NOT NULL,
         "partnerId" integer NOT NULL,
         "readAt" TIMESTAMP NOT NULL DEFAULT now(),
         CONSTRAINT "PK_partner_notification_read" PRIMARY KEY ("id"),
         CONSTRAINT "UQ_partner_notification_read" UNIQUE ("notificationId", "partnerId")
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_partner_notification_read_partner"
         ON "partner_notification_read" ("partnerId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "partner_notification_read"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "partner_notification"`);
  }
}
