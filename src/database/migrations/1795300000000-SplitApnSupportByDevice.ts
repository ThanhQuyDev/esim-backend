import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tách hỗ trợ app theo thiết bị, và thêm Gemini + Claude (#065).
 *
 * Bảng `apn_support` dựng ngày 01/10/2026 theo mô tả về file: một cột ChatGPT
 * dùng chung cho mọi thiết bị. File thật ("APN Tiktok-GPT", nhận 02/10/2026) lại
 * tách **cả bốn** app theo thiết bị — mỗi APN có 2 dòng, iPhone và Android — và
 * có thêm Gemini, Claude. Bảng cũ không chứa nổi dữ liệu đó.
 *
 * Bảng khởi tạo trống và chưa deploy ở đâu, nên các cột mới mặc định false là
 * đủ: lần nạp file đầu tiên sẽ ghi toàn bộ. `chatGpt` cũ được chép sang cả hai
 * thiết bị phòng trường hợp có môi trường nào đã nạp dữ liệu trước đó, rồi mới
 * xoá — để không mất câu trả lời đã có.
 */
export class SplitApnSupportByDevice1795300000000 implements MigrationInterface {
  name = 'SplitApnSupportByDevice1795300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      'chatGptIos',
      'chatGptAndroid',
      'geminiIos',
      'geminiAndroid',
      'claudeIos',
      'claudeAndroid',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "apn_support" ADD COLUMN IF NOT EXISTS "${column}" boolean NOT NULL DEFAULT false`,
      );
    }

    // Giữ lại câu trả lời ChatGPT cũ nếu môi trường nào đó đã nạp dữ liệu.
    const hasOld = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_name = 'apn_support' AND column_name = 'chatGpt'`,
    );
    if (hasOld.length) {
      await queryRunner.query(
        `UPDATE "apn_support"
            SET "chatGptIos" = "chatGpt", "chatGptAndroid" = "chatGpt"`,
      );
      await queryRunner.query(
        `ALTER TABLE "apn_support" DROP COLUMN IF EXISTS "chatGpt"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "apn_support" ADD COLUMN IF NOT EXISTS "chatGpt" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "apn_support" SET "chatGpt" = "chatGptIos" AND "chatGptAndroid"`,
    );
    for (const column of [
      'chatGptIos',
      'chatGptAndroid',
      'geminiIos',
      'geminiAndroid',
      'claudeIos',
      'claudeAndroid',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "apn_support" DROP COLUMN IF EXISTS "${column}"`,
      );
    }
  }
}
