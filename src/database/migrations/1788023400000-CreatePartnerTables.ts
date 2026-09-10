import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePartnerTables1788023400000 implements MigrationInterface {
  name = 'CreatePartnerTables1788023400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "partner" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "partnerType" character varying NOT NULL,
        "legalType" character varying NOT NULL,
        "companyName" character varying,
        "taxCode" character varying,
        "businessAddress" character varying,
        "contactName" character varying NOT NULL,
        "contactPhone" character varying NOT NULL,
        "contactEmail" character varying NOT NULL,
        "channelInfo" jsonb,
        "status" character varying NOT NULL DEFAULT 'pending',
        "tierCode" character varying,
        "assignedManagerId" integer,
        "approvedAt" TIMESTAMP,
        "approvedByAdminId" integer,
        "rejectionReason" character varying,
        "notes" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "UQ_partner_userId" UNIQUE ("userId"),
        CONSTRAINT "PK_partner" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_userId" ON "partner" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_partnerType" ON "partner" ("partnerType")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_status" ON "partner" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_tierCode" ON "partner" ("tierCode")`,
    );

    await queryRunner.query(`
      CREATE TABLE "partner_wallet" (
        "id" SERIAL NOT NULL,
        "partnerId" integer NOT NULL,
        "balanceVnd" decimal(14,0) NOT NULL DEFAULT 0,
        "status" character varying NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_partner_wallet_partnerId" UNIQUE ("partnerId"),
        CONSTRAINT "PK_partner_wallet" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_wallet_partnerId" ON "partner_wallet" ("partnerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_wallet_status" ON "partner_wallet" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "partner_wallet_transaction" (
        "id" SERIAL NOT NULL,
        "walletId" integer NOT NULL,
        "partnerId" integer NOT NULL,
        "type" character varying NOT NULL,
        "amountVnd" decimal(14,0) NOT NULL,
        "balanceAfterVnd" decimal(14,0) NOT NULL,
        "sourceType" character varying,
        "sourceId" character varying,
        "orderId" integer,
        "idempotencyKey" character varying,
        "reason" character varying,
        "metadata" jsonb,
        "createdByAdminId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_partner_wallet_transaction_idempotencyKey" UNIQUE ("idempotencyKey"),
        CONSTRAINT "PK_partner_wallet_transaction" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_wallet_transaction_walletId" ON "partner_wallet_transaction" ("walletId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_wallet_transaction_partnerId" ON "partner_wallet_transaction" ("partnerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_wallet_transaction_type" ON "partner_wallet_transaction" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_wallet_transaction_sourceType" ON "partner_wallet_transaction" ("sourceType")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_wallet_transaction_sourceId" ON "partner_wallet_transaction" ("sourceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_wallet_transaction_orderId" ON "partner_wallet_transaction" ("orderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_wallet_transaction_idempotencyKey" ON "partner_wallet_transaction" ("idempotencyKey")`,
    );

    await queryRunner.query(`
      CREATE TABLE "partner_deposit_request" (
        "id" SERIAL NOT NULL,
        "partnerId" integer NOT NULL,
        "amountVnd" decimal(14,0) NOT NULL,
        "bankTransferCode" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "confirmedByAdminId" integer,
        "confirmedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_partner_deposit_request_bankTransferCode" UNIQUE ("bankTransferCode"),
        CONSTRAINT "PK_partner_deposit_request" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_deposit_request_partnerId" ON "partner_deposit_request" ("partnerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_deposit_request_status" ON "partner_deposit_request" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "partner_tier" (
        "id" SERIAL NOT NULL,
        "partnerType" character varying NOT NULL,
        "tierCode" character varying NOT NULL,
        "tierName" character varying NOT NULL,
        "minVolumeVnd" decimal(14,0) NOT NULL DEFAULT 0,
        "commissionPercent" decimal(5,2) NOT NULL DEFAULT 0,
        "maxDiscountPercent" decimal(5,2) NOT NULL DEFAULT 0,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_partner_tier" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_tier_partnerType" ON "partner_tier" ("partnerType")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_partner_tier_partnerType_tierCode" ON "partner_tier" ("partnerType", "tierCode")`,
    );

    await queryRunner.query(`
      CREATE TABLE "partner_link" (
        "id" SERIAL NOT NULL,
        "partnerId" integer NOT NULL,
        "code" character varying(32) NOT NULL,
        "label" character varying,
        "targetPath" character varying,
        "isActive" boolean NOT NULL DEFAULT true,
        "clickCount" integer NOT NULL DEFAULT 0,
        "conversionCount" integer NOT NULL DEFAULT 0,
        "totalCommissionVnd" decimal(14,0) NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_partner_link_code" UNIQUE ("code"),
        CONSTRAINT "PK_partner_link" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_link_partnerId" ON "partner_link" ("partnerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_link_code" ON "partner_link" ("code")`,
    );

    await queryRunner.query(`
      CREATE TABLE "partner_link_click" (
        "id" SERIAL NOT NULL,
        "linkId" integer NOT NULL,
        "ipHash" character varying,
        "userAgent" character varying,
        "referrer" character varying,
        "visitorId" character varying,
        "clickedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_partner_link_click" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_link_click_linkId" ON "partner_link_click" ("linkId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_link_click_visitorId" ON "partner_link_click" ("visitorId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "order_partner_commission" (
        "id" SERIAL NOT NULL,
        "orderId" integer NOT NULL,
        "partnerId" integer NOT NULL,
        "linkId" integer,
        "commissionVnd" decimal(14,0) NOT NULL DEFAULT 0,
        "tierSnapshot" character varying,
        "status" character varying NOT NULL DEFAULT 'pending',
        "rewardTransactionId" integer,
        "reversedTransactionId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_order_partner_commission_orderId" UNIQUE ("orderId"),
        CONSTRAINT "PK_order_partner_commission" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_order_partner_commission_orderId" ON "order_partner_commission" ("orderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_partner_commission_partnerId" ON "order_partner_commission" ("partnerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_partner_commission_linkId" ON "order_partner_commission" ("linkId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_partner_commission_status" ON "order_partner_commission" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "partner_payout" (
        "id" SERIAL NOT NULL,
        "partnerId" integer NOT NULL,
        "amountVnd" decimal(14,0) NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "bankInfo" jsonb,
        "adminNote" character varying,
        "processedByAdminId" integer,
        "processedAt" TIMESTAMP,
        "walletTransactionId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_partner_payout" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_payout_partnerId" ON "partner_payout" ("partnerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_payout_status" ON "partner_payout" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_partner_payout_status"`);
    await queryRunner.query(`DROP INDEX "IDX_partner_payout_partnerId"`);
    await queryRunner.query(`DROP TABLE "partner_payout"`);

    await queryRunner.query(`DROP INDEX "IDX_order_partner_commission_status"`);
    await queryRunner.query(`DROP INDEX "IDX_order_partner_commission_linkId"`);
    await queryRunner.query(
      `DROP INDEX "IDX_order_partner_commission_partnerId"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_order_partner_commission_orderId"`,
    );
    await queryRunner.query(`DROP TABLE "order_partner_commission"`);

    await queryRunner.query(`DROP INDEX "IDX_partner_link_click_visitorId"`);
    await queryRunner.query(`DROP INDEX "IDX_partner_link_click_linkId"`);
    await queryRunner.query(`DROP TABLE "partner_link_click"`);

    await queryRunner.query(`DROP INDEX "IDX_partner_link_code"`);
    await queryRunner.query(`DROP INDEX "IDX_partner_link_partnerId"`);
    await queryRunner.query(`DROP TABLE "partner_link"`);

    await queryRunner.query(
      `DROP INDEX "UQ_partner_tier_partnerType_tierCode"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_partner_tier_partnerType"`);
    await queryRunner.query(`DROP TABLE "partner_tier"`);

    await queryRunner.query(`DROP INDEX "IDX_partner_deposit_request_status"`);
    await queryRunner.query(
      `DROP INDEX "IDX_partner_deposit_request_partnerId"`,
    );
    await queryRunner.query(`DROP TABLE "partner_deposit_request"`);

    await queryRunner.query(
      `DROP INDEX "IDX_partner_wallet_transaction_idempotencyKey"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_partner_wallet_transaction_orderId"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_partner_wallet_transaction_sourceId"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_partner_wallet_transaction_sourceType"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_partner_wallet_transaction_type"`);
    await queryRunner.query(
      `DROP INDEX "IDX_partner_wallet_transaction_partnerId"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_partner_wallet_transaction_walletId"`,
    );
    await queryRunner.query(`DROP TABLE "partner_wallet_transaction"`);

    await queryRunner.query(`DROP INDEX "IDX_partner_wallet_status"`);
    await queryRunner.query(`DROP INDEX "IDX_partner_wallet_partnerId"`);
    await queryRunner.query(`DROP TABLE "partner_wallet"`);

    await queryRunner.query(`DROP INDEX "IDX_partner_tierCode"`);
    await queryRunner.query(`DROP INDEX "IDX_partner_status"`);
    await queryRunner.query(`DROP INDEX "IDX_partner_partnerType"`);
    await queryRunner.query(`DROP INDEX "IDX_partner_userId"`);
    await queryRunner.query(`DROP TABLE "partner"`);
  }
}
