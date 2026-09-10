import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPartnerAttributionToOrder1788023500000 implements MigrationInterface {
  name = 'AddPartnerAttributionToOrder1788023500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD "partnerLinkCode" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "attributedPartnerId" integer`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_partnerLinkCode" ON "order" ("partnerLinkCode")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_attributedPartnerId" ON "order" ("attributedPartnerId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_order_attributedPartnerId"`);
    await queryRunner.query(`DROP INDEX "IDX_order_partnerLinkCode"`);
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "attributedPartnerId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "partnerLinkCode"`,
    );
  }
}
