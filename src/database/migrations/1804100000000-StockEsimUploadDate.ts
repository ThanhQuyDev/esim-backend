import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Unsold stock read the date of its first upload (vande-0411 #045). Only a
 * re-upload touches these rows, so their `updatedAt` is when it last came in.
 */
export class StockEsimUploadDate1804100000000 implements MigrationInterface {
  name = 'StockEsimUploadDate1804100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "esim" SET "createdAt" = "updatedAt"
       WHERE "status" = 'available'
         AND "deletedAt" IS NULL
         AND "updatedAt" > "createdAt"
         AND ("provider" = 'viettel' OR "provider" LIKE '%-noidia')`);
  }

  public async down(): Promise<void> {
    // The first upload's date is not kept.
  }
}
