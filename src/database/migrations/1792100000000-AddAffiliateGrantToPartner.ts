import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Whether a distribution partner may also earn affiliate commission (#048).
 *
 * The two programmes are separate: a distribution partner buys stock and resells
 * it, a marketing partner earns commission on orders placed on esim.vn. Some
 * distributors do both, but only when esim.vn grants it — so the marketing
 * screens (link, mã giảm giá, hoa hồng, rút tiền) stay out of their portal until
 * this is ticked.
 *
 * Marketing partners are the affiliate programme, so theirs is granted by what
 * they are; the column only decides the question for a distributor.
 */
export class AddAffiliateGrantToPartner1792100000000 implements MigrationInterface {
  name = 'AddAffiliateGrantToPartner1792100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" ADD COLUMN IF NOT EXISTS "canAffiliate" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" DROP COLUMN IF EXISTS "canAffiliate"`,
    );
  }
}
