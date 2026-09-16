import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Japan Travel SIM is removed from the system (#008).
 *
 * The integration code is gone, so a Japan Travel SIM plan left on sale would
 * take the customer's money and never deliver an eSIM. Its plans are taken off
 * sale; past orders and eSIMs keep their rows and still display.
 */
export class DeactivateJapanTravelSimPlans1790400000000 implements MigrationInterface {
  name = 'DeactivateJapanTravelSimPlans1790400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "plan" SET "isActive" = false WHERE "provider" = 'japantravelsim' AND "isActive" = true`,
    );
  }

  public async down(): Promise<void> {
    // Which plans were on sale before is not recorded, and re-activating them
    // without the integration would sell eSIMs that cannot be delivered.
  }
}
