import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLoyaltyTiers1780700000000 implements MigrationInterface {
  name = 'AddLoyaltyTiers1780700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "lifetimeSpendVnd" decimal(14,0) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "tierOverride" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "tierOverrideReason" character varying`,
    );

    await queryRunner.query(
      `ALTER TABLE "order" ADD "membershipTierSnapshot" character varying NOT NULL DEFAULT 'traveler'`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "tierSourceSnapshot" character varying NOT NULL DEFAULT 'automatic'`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "cashbackPercentSnapshot" decimal(5,2) NOT NULL DEFAULT 2`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "eligibleSpendVnd" decimal(14,0) NOT NULL DEFAULT 0`,
    );

    await queryRunner.query(
      `ALTER TABLE "order_referral" ADD "membershipTierSnapshot" character varying NOT NULL DEFAULT 'traveler'`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_referral" ADD "tierSourceSnapshot" character varying NOT NULL DEFAULT 'automatic'`,
    );

    await queryRunner.query(`
      CREATE TABLE "user_spend_transaction" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "orderId" integer,
        "refundId" integer,
        "type" character varying NOT NULL,
        "amountVnd" decimal(14,0) NOT NULL,
        "idempotencyKey" character varying NOT NULL,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_spend_transaction_idempotencyKey" UNIQUE ("idempotencyKey"),
        CONSTRAINT "PK_user_spend_transaction" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_user_spend_transaction_userId" ON "user_spend_transaction" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_spend_transaction_orderId" ON "user_spend_transaction" ("orderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_spend_transaction_refundId" ON "user_spend_transaction" ("refundId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_spend_transaction_type" ON "user_spend_transaction" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_spend_transaction_idempotencyKey" ON "user_spend_transaction" ("idempotencyKey")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_spend_transaction" ADD CONSTRAINT "FK_user_spend_transaction_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_spend_transaction" ADD CONSTRAINT "FK_user_spend_transaction_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_spend_transaction" ADD CONSTRAINT "FK_user_spend_transaction_refund" FOREIGN KEY ("refundId") REFERENCES "order_refund"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(`
      UPDATE "order"
      SET "eligibleSpendVnd" = GREATEST(
        0,
        "subtotalVndPrice" - "couponDiscountVndAmount" - "referralDiscountVndAmount"
      )
      WHERE "subtotalVndPrice" > 0
        AND "status" IN ('paid', 'refunded')
    `);

    await queryRunner.query(`
      INSERT INTO "user_spend_transaction" (
        "userId", "orderId", "refundId", "type", "amountVnd",
        "idempotencyKey", "metadata"
      )
      SELECT
        o."userId",
        o."id",
        NULL,
        'backfill',
        o."eligibleSpendVnd",
        'lifetime_spend:backfill:purchase:' || o."id",
        jsonb_build_object('source', 'trusted_order_pricing')
      FROM "order" o
      WHERE o."subtotalVndPrice" > 0
        AND o."eligibleSpendVnd" > 0
        AND o."status" IN ('paid', 'refunded')
      ON CONFLICT ("idempotencyKey") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "user_spend_transaction" (
        "userId", "orderId", "refundId", "type", "amountVnd",
        "idempotencyKey", "metadata"
      )
      SELECT
        o."userId",
        o."id",
        NULL,
        'backfill',
        -LEAST(
          o."eligibleSpendVnd",
          CASE
            WHEN (o."payableVndPrice" + o."walletSpentVndAmount") > 0 THEN
              ROUND(
                o."eligibleSpendVnd" * o."refundedAmountVnd" /
                (o."payableVndPrice" + o."walletSpentVndAmount")
              )
            ELSE 0
          END
        ),
        'lifetime_spend:backfill:refund:' || o."id",
        jsonb_build_object('source', 'trusted_order_refund_summary')
      FROM "order" o
      WHERE o."subtotalVndPrice" > 0
        AND o."eligibleSpendVnd" > 0
        AND o."refundedAmountVnd" > 0
        AND o."status" = 'refunded'
      ON CONFLICT ("idempotencyKey") DO NOTHING
    `);

    await queryRunner.query(`
      UPDATE "user" u
      SET "lifetimeSpendVnd" = summary.total
      FROM (
        SELECT "userId", GREATEST(0, SUM("amountVnd")) AS total
        FROM "user_spend_transaction"
        GROUP BY "userId"
      ) summary
      WHERE u."id" = summary."userId"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_spend_transaction" DROP CONSTRAINT "FK_user_spend_transaction_refund"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_spend_transaction" DROP CONSTRAINT "FK_user_spend_transaction_order"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_spend_transaction" DROP CONSTRAINT "FK_user_spend_transaction_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_user_spend_transaction_idempotencyKey"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_user_spend_transaction_type"`);
    await queryRunner.query(`DROP INDEX "IDX_user_spend_transaction_refundId"`);
    await queryRunner.query(`DROP INDEX "IDX_user_spend_transaction_orderId"`);
    await queryRunner.query(`DROP INDEX "IDX_user_spend_transaction_userId"`);
    await queryRunner.query(`DROP TABLE "user_spend_transaction"`);

    await queryRunner.query(
      `ALTER TABLE "order_referral" DROP COLUMN "tierSourceSnapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_referral" DROP COLUMN "membershipTierSnapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "eligibleSpendVnd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "cashbackPercentSnapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "tierSourceSnapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "membershipTierSnapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "tierOverrideReason"`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "tierOverride"`);
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "lifetimeSpendVnd"`,
    );
  }
}
