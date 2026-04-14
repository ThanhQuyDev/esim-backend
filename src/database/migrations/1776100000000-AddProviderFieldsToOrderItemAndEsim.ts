import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProviderFieldsToOrderItemAndEsim1776100000000 implements MigrationInterface {
  name = 'AddProviderFieldsToOrderItemAndEsim1776100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // order_item: add providerOrderId, providerOrderCode
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD "providerOrderId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD "providerOrderCode" character varying`,
    );

    // esim: add lpa, matchId, qrcode, directAppleInstallationUrl, apnValue, isRoaming
    await queryRunner.query(`ALTER TABLE "esim" ADD "lpa" character varying`);
    await queryRunner.query(
      `ALTER TABLE "esim" ADD "matchId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" ADD "qrcode" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" ADD "directAppleInstallationUrl" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" ADD "apnValue" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "esim" ADD "isRoaming" boolean`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "esim" DROP COLUMN IF EXISTS "isRoaming"`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" DROP COLUMN IF EXISTS "apnValue"`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" DROP COLUMN IF EXISTS "directAppleInstallationUrl"`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" DROP COLUMN IF EXISTS "qrcode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" DROP COLUMN IF EXISTS "matchId"`,
    );
    await queryRunner.query(`ALTER TABLE "esim" DROP COLUMN IF EXISTS "lpa"`);
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP COLUMN IF EXISTS "providerOrderCode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP COLUMN IF EXISTS "providerOrderId"`,
    );
  }
}
