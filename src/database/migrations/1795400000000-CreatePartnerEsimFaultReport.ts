import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Đối tác báo eSIM lỗi, admin duyệt tay mới hoàn tiền (#046).
 *
 * Chốt 02/10/2026. Bảng này là chỗ ký: không có nó thì tiền ra khỏi quỹ mà
 * không ai chịu trách nhiệm, và đối tác không có chỗ nào để theo dõi khiếu
 * nại của mình.
 */
export class CreatePartnerEsimFaultReport1795400000000 implements MigrationInterface {
  name = 'CreatePartnerEsimFaultReport1795400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "partner_esim_fault_report" (
        "id" SERIAL PRIMARY KEY,
        "partnerId" integer NOT NULL,
        "orderId" integer NOT NULL,
        "orderNumber" varchar NOT NULL,
        "iccid" varchar NOT NULL,
        "reason" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "refundVnd" bigint NOT NULL DEFAULT 0,
        "adminNote" varchar,
        "reviewedByAdminId" integer,
        "reviewedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    for (const column of ['partnerId', 'orderId', 'iccid', 'status']) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_partner_esim_fault_${column.toLowerCase()}"
            ON "partner_esim_fault_report" ("${column}")`,
      );
    }

    // Một eSIM chỉ được báo lỗi một lần đang chờ xử lý. Thiếu ràng buộc này,
    // đối tác bấm hai lần sẽ tạo hai phiếu cho cùng một eSIM và esim.vn có thể
    // duyệt hoàn hai lần cho một cái hàng.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_partner_esim_fault_open"
        ON "partner_esim_fault_report" ("iccid")
        WHERE "status" = 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "partner_esim_fault_report"`);
  }
}
