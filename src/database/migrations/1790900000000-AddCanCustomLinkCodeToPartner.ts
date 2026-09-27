import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Who may name their own referral link (#014).
 *
 * A memorable `/go/TENTUY` is for the partners an admin has decided to trust —
 * the brief ties it to "hạng đối tác cấp cao do admin tích chọn thủ công", so
 * it is a per-partner switch rather than something a tier grants automatically.
 */
export class AddCanCustomLinkCodeToPartner1790900000000 implements MigrationInterface {
  name = 'AddCanCustomLinkCodeToPartner1790900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" ADD "canCustomLinkCode" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" DROP COLUMN "canCustomLinkCode"`,
    );
  }
}
