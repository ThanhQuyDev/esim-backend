import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gỡ các link "esim.vn" do trình soạn thảo tự chèn (v3 #024).
 *
 * Trình soạn thảo của FAQ và "Tại sao chọn chúng tôi" dùng StarterKit của TipTap
 * v3, vốn kèm sẵn Link với autolink bật — cứ gõ "esim.vn" là thành
 * `<a href="http(s)://esim.vn">esim.vn</a>`. Editor đã được sửa; migration này
 * dọn những đoạn đã lưu.
 *
 * Chỉ gỡ đúng dạng tự chèn: chữ hiển thị là chính tên miền (esim.vn /
 * www.esim.vn) và link trỏ về trang chủ. Link admin tự thêm có chữ khác (vd
 * "Xem gói Nhật Bản") hoặc trỏ tới trang con thì giữ nguyên. Không có `down`:
 * không có cách nào phân biệt để chèn lại, và chữ "esim.vn" vẫn còn nguyên.
 */
const AUTOLINK = `<a [^>]*href="https?://(www\\.)?esim\\.vn/?"[^>]*>((www\\.)?esim\\.vn)</a>`;

const TARGETS: Array<[table: string, column: string]> = [
  ['why_choose_us', 'title'],
  ['why_choose_us', 'description'],
  ['faq', 'question'],
  ['faq', 'answer'],
];

export class UnwrapAutolinkedEsimVn1795600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column] of TARGETS) {
      await queryRunner.query(
        `UPDATE "${table}"
            SET "${column}" = regexp_replace("${column}", $1, '\\2', 'gi')
          WHERE "${column}" ~* $1`,
        [AUTOLINK],
      );
    }
  }

  public async down(): Promise<void> {
    // Nothing to restore — see above.
  }
}
