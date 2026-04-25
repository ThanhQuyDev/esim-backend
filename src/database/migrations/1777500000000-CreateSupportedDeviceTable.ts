import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSupportedDeviceTable1777500000000 implements MigrationInterface {
  name = 'CreateSupportedDeviceTable1777500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "supported_device_type_enum" AS ENUM('Smart Phones', 'Smart Watches', 'Tablets', 'Laptops')`,
    );
    await queryRunner.query(
      `CREATE TABLE "supported_device" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "device" character varying NOT NULL,
        "manufacturer" character varying NOT NULL,
        "type" "supported_device_type_enum" NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_supported_device" PRIMARY KEY ("id")
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "supported_device"`);
    await queryRunner.query(`DROP TYPE "supported_device_type_enum"`);
  }
}
