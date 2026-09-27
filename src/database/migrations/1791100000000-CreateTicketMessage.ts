import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replies inside a support ticket (#032).
 *
 * A ticket used to be a one-way form: the partner described a problem and then
 * had nowhere to answer the question that came back. Both sides now write in
 * the same thread, so the whole exchange lives with the ticket rather than in
 * somebody's inbox.
 */
export class CreateTicketMessage1791100000000 implements MigrationInterface {
  name = 'CreateTicketMessage1791100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ticket_message" (
        "id" SERIAL NOT NULL,
        "ticketId" integer NOT NULL,
        "authorRole" character varying NOT NULL,
        "authorName" character varying,
        "body" text NOT NULL,
        "attachments" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ticket_message" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ticket_message_ticketId" ON "ticket_message" ("ticketId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_message" ADD CONSTRAINT "FK_ticket_message_ticket"
       FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ticket_message"`);
  }
}
