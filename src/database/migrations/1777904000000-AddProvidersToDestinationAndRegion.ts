import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProvidersToDestinationAndRegion1777904000000 implements MigrationInterface {
  name = 'AddProvidersToDestinationAndRegion1777904000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "destination" ADD IF NOT EXISTS "providers" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "region" ADD IF NOT EXISTS "providers" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "region" DROP COLUMN IF EXISTS "providers"`,
    );
    await queryRunner.query(
      `ALTER TABLE "destination" DROP COLUMN IF EXISTS "providers"`,
    );
  }
}
