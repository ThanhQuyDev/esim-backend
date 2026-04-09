import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDestinationParentId1775752888504 implements MigrationInterface {
    name = 'AddDestinationParentId1775752888504'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "destination" ADD "parentId" integer`);
        await queryRunner.query(`ALTER TABLE "destination" ADD CONSTRAINT "FK_3764ae5b607419a0dfea0128376" FOREIGN KEY ("parentId") REFERENCES "destination"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "destination" DROP CONSTRAINT "FK_3764ae5b607419a0dfea0128376"`);
        await queryRunner.query(`ALTER TABLE "destination" DROP COLUMN "parentId"`);
    }

}
