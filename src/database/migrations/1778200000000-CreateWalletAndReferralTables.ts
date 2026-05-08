import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWalletAndReferralTables1778200000000 implements MigrationInterface {
  name = 'CreateWalletAndReferralTables1778200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_wallet" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "balanceVnd" decimal(14,0) NOT NULL DEFAULT 0,
        "status" character varying NOT NULL DEFAULT 'active',
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_wallet_userId" UNIQUE ("userId"),
        CONSTRAINT "PK_user_wallet" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_user_wallet_userId" ON "user_wallet" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_wallet_status" ON "user_wallet" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_wallet_expiresAt" ON "user_wallet" ("expiresAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE "wallet_transaction" (
        "id" SERIAL NOT NULL,
        "walletId" integer NOT NULL,
        "userId" integer NOT NULL,
        "type" character varying NOT NULL,
        "amountVnd" decimal(14,0) NOT NULL,
        "balanceAfterVnd" decimal(14,0) NOT NULL,
        "sourceType" character varying,
        "sourceId" character varying,
        "orderId" integer,
        "refUserId" integer,
        "idempotencyKey" character varying,
        "reason" character varying,
        "metadata" jsonb,
        "createdByAdminId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_wallet_transaction_idempotencyKey" UNIQUE ("idempotencyKey"),
        CONSTRAINT "PK_wallet_transaction" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_transaction_walletId" ON "wallet_transaction" ("walletId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_transaction_userId" ON "wallet_transaction" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_transaction_type" ON "wallet_transaction" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_transaction_sourceType" ON "wallet_transaction" ("sourceType")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_transaction_sourceId" ON "wallet_transaction" ("sourceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_transaction_orderId" ON "wallet_transaction" ("orderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_transaction_refUserId" ON "wallet_transaction" ("refUserId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_transaction_idempotencyKey" ON "wallet_transaction" ("idempotencyKey")`,
    );

    await queryRunner.query(`
      CREATE TABLE "wallet_hold" (
        "id" SERIAL NOT NULL,
        "walletId" integer NOT NULL,
        "userId" integer NOT NULL,
        "orderId" integer NOT NULL,
        "amountVnd" decimal(14,0) NOT NULL,
        "status" character varying NOT NULL DEFAULT 'held',
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_wallet_hold_orderId" UNIQUE ("orderId"),
        CONSTRAINT "PK_wallet_hold" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_hold_walletId" ON "wallet_hold" ("walletId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_hold_userId" ON "wallet_hold" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_hold_orderId" ON "wallet_hold" ("orderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_hold_status" ON "wallet_hold" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_hold_expiresAt" ON "wallet_hold" ("expiresAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE "user_referral_profile" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "code" character varying(50) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_referral_profile_userId" UNIQUE ("userId"),
        CONSTRAINT "UQ_user_referral_profile_code" UNIQUE ("code"),
        CONSTRAINT "PK_user_referral_profile" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_user_referral_profile_userId" ON "user_referral_profile" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_referral_profile_code" ON "user_referral_profile" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_referral_profile_isActive" ON "user_referral_profile" ("isActive")`,
    );

    await queryRunner.query(`
      CREATE TABLE "order_referral" (
        "id" SERIAL NOT NULL,
        "orderId" integer NOT NULL,
        "referrerUserId" integer NOT NULL,
        "refereeUserId" integer NOT NULL,
        "referralCode" character varying(50) NOT NULL,
        "buyerDiscountVnd" decimal(14,0) NOT NULL DEFAULT 10000,
        "rewardVnd" decimal(14,0) NOT NULL DEFAULT 10000,
        "status" character varying NOT NULL DEFAULT 'pending',
        "rewardTransactionId" integer,
        "reversedTransactionId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_order_referral_orderId" UNIQUE ("orderId"),
        CONSTRAINT "PK_order_referral" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_order_referral_orderId" ON "order_referral" ("orderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_referral_referrerUserId" ON "order_referral" ("referrerUserId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_referral_refereeUserId" ON "order_referral" ("refereeUserId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_referral_referralCode" ON "order_referral" ("referralCode")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_referral_status" ON "order_referral" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "order_refund" (
        "id" SERIAL NOT NULL,
        "orderId" integer NOT NULL,
        "userId" integer NOT NULL,
        "mode" character varying NOT NULL,
        "amountVnd" decimal(14,0) NOT NULL,
        "status" character varying NOT NULL DEFAULT 'completed',
        "reason" character varying,
        "adminNote" character varying,
        "walletTransactionId" integer,
        "createdByAdminId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_refund" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_order_refund_orderId" ON "order_refund" ("orderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_refund_userId" ON "order_refund" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_refund_mode" ON "order_refund" ("mode")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_refund_status" ON "order_refund" ("status")`,
    );

    await queryRunner.query(
      `ALTER TABLE "order" ADD "subtotalVndPrice" decimal(14,0) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "couponDiscountVndAmount" decimal(14,0) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "referralCode" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "order" ADD "referrerUserId" integer`);
    await queryRunner.query(
      `ALTER TABLE "order" ADD "referralDiscountVndAmount" decimal(14,0) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "walletSpentVndAmount" decimal(14,0) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "payableVndPrice" decimal(14,0) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "cashbackAmountVnd" decimal(14,0) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "cashbackTransactionId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "cashbackReversedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "refundStatus" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "refundedAmountVnd" decimal(14,0) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_referralCode" ON "order" ("referralCode")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_referrerUserId" ON "order" ("referrerUserId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_order_referrerUserId"`);
    await queryRunner.query(`DROP INDEX "IDX_order_referralCode"`);
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "refundedAmountVnd"`,
    );
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "refundStatus"`);
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "cashbackReversedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "cashbackTransactionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "cashbackAmountVnd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "payableVndPrice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "walletSpentVndAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "referralDiscountVndAmount"`,
    );
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "referrerUserId"`);
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "referralCode"`);
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "couponDiscountVndAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "subtotalVndPrice"`,
    );

    await queryRunner.query(`DROP INDEX "IDX_order_refund_status"`);
    await queryRunner.query(`DROP INDEX "IDX_order_refund_mode"`);
    await queryRunner.query(`DROP INDEX "IDX_order_refund_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_order_refund_orderId"`);
    await queryRunner.query(`DROP TABLE "order_refund"`);

    await queryRunner.query(`DROP INDEX "IDX_order_referral_status"`);
    await queryRunner.query(`DROP INDEX "IDX_order_referral_referralCode"`);
    await queryRunner.query(`DROP INDEX "IDX_order_referral_refereeUserId"`);
    await queryRunner.query(`DROP INDEX "IDX_order_referral_referrerUserId"`);
    await queryRunner.query(`DROP INDEX "IDX_order_referral_orderId"`);
    await queryRunner.query(`DROP TABLE "order_referral"`);

    await queryRunner.query(`DROP INDEX "IDX_user_referral_profile_isActive"`);
    await queryRunner.query(`DROP INDEX "IDX_user_referral_profile_code"`);
    await queryRunner.query(`DROP INDEX "IDX_user_referral_profile_userId"`);
    await queryRunner.query(`DROP TABLE "user_referral_profile"`);

    await queryRunner.query(`DROP INDEX "IDX_wallet_hold_expiresAt"`);
    await queryRunner.query(`DROP INDEX "IDX_wallet_hold_status"`);
    await queryRunner.query(`DROP INDEX "IDX_wallet_hold_orderId"`);
    await queryRunner.query(`DROP INDEX "IDX_wallet_hold_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_wallet_hold_walletId"`);
    await queryRunner.query(`DROP TABLE "wallet_hold"`);

    await queryRunner.query(
      `DROP INDEX "IDX_wallet_transaction_idempotencyKey"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_wallet_transaction_refUserId"`);
    await queryRunner.query(`DROP INDEX "IDX_wallet_transaction_orderId"`);
    await queryRunner.query(`DROP INDEX "IDX_wallet_transaction_sourceId"`);
    await queryRunner.query(`DROP INDEX "IDX_wallet_transaction_sourceType"`);
    await queryRunner.query(`DROP INDEX "IDX_wallet_transaction_type"`);
    await queryRunner.query(`DROP INDEX "IDX_wallet_transaction_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_wallet_transaction_walletId"`);
    await queryRunner.query(`DROP TABLE "wallet_transaction"`);

    await queryRunner.query(`DROP INDEX "IDX_user_wallet_expiresAt"`);
    await queryRunner.query(`DROP INDEX "IDX_user_wallet_status"`);
    await queryRunner.query(`DROP INDEX "IDX_user_wallet_userId"`);
    await queryRunner.query(`DROP TABLE "user_wallet"`);
  }
}
