import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * How long a customer has to activate an eSIM before it is wasted (#070).
 *
 * The storefront printed a flat "180 ngày kể từ ngày mua" for the whole
 * catalogue; suppliers actually allow 30–180 days depending on the package, so
 * that line was wrong for most plans in a way that costs the customer their eSIM.
 *
 * No backfill. The value is a per-package fact only the supplier knows, and the
 * next catalogue sync writes it (esimaccess `unusedValidTime`, MicroEsim
 * `validity_period`, the GadgetKorea Validity column). Guessing 180 here would
 * put exactly the wrong number back, and it would then look like real data.
 * Local stock never uses this column: those eSIMs carry a printed expiry from the
 * import file, which is read off the eSIM rows instead.
 */
export class AddActivationValidityToPlan1794800000000 implements MigrationInterface {
  name = 'AddActivationValidityToPlan1794800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "activationValidityDays" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "activationValidityDays"`,
    );
  }
}
