import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tách "eSIM nội địa" ra khỏi "eSIM du lịch của nhà mạng trong nước".
 *
 * Hai thứ khác nhau nhưng trước đây cùng đi qua một cờ `isLocalInventory`:
 *
 * 1. **eSIM nội địa** — SIM data dùng trong nước (Wintel, iTEL, VNSKY). Có tab
 *    riêng ở trang chủ cạnh Quốc gia / Khu vực, và trang chi tiết riêng
 *    `/esim-noi-dia/[carrier]`.
 * 2. **eSIM du lịch của nhà mạng trong nước** — Viettel bán eSIM cho khách đi
 *    nước ngoài. Nó là một gói du lịch bình thường, nằm trong tab
 *    Quốc gia → Việt Nam cùng các gói khác.
 *
 * `isLocalInventory` mang nghĩa "hàng mình giữ, giá niêm yết bằng VND" — nó chi
 * phối toàn bộ phần tính giá và đặt hàng, nên **cả hai loại đều phải giữ
 * `isLocalInventory = true`**. Cờ mới chỉ trả lời một câu: gói này thuộc tab
 * eSIM nội địa hay không.
 *
 * Mặc định `false` là có chủ ý: 3 gói Viettel đang có sẵn sẽ chuyển sang nhóm
 * du lịch của trang Việt Nam ngay sau migration, đúng như yêu cầu. Gói nội địa
 * thật (Wintel / iTEL / VNSKY) chưa có trong bảng — sẽ được đánh dấu lúc nhập
 * file bằng nút "Nhập eSIM nội địa" riêng.
 */
export class AddIsDomesticEsimToPlan1795500000000 implements MigrationInterface {
  name = 'AddIsDomesticEsimToPlan1795500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "isDomesticEsim" boolean NOT NULL DEFAULT false`,
    );
    // Tab nội địa và trang từng nhà mạng đều lọc theo cờ này.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_plan_is_domestic_esim" ON "plan" ("isDomesticEsim")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_plan_is_domestic_esim"`);
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "isDomesticEsim"`,
    );
  }
}
