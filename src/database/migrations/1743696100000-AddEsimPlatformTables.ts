import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEsimPlatformTables1743696100000 implements MigrationInterface {
  name = 'AddEsimPlatformTables1743696100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop continent from destination
    await queryRunner.query(`DROP INDEX "IDX_destination_continent"`);
    await queryRunner.query(`ALTER TABLE "destination" DROP COLUMN "continent"`);
    await queryRunner.query(`ALTER TABLE "destination" DROP COLUMN "region"`);

    // 2. Create region table (hierarchical)
    await queryRunner.query(
      `CREATE TABLE "region" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "slug" character varying NOT NULL, "parentId" integer, "avatarUrl" character varying, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_region_slug" UNIQUE ("slug"), CONSTRAINT "PK_region" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_region_name" ON "region" ("name")`);
    await queryRunner.query(`CREATE INDEX "IDX_region_isActive" ON "region" ("isActive")`);
    await queryRunner.query(
      `ALTER TABLE "region" ADD CONSTRAINT "FK_region_parent" FOREIGN KEY ("parentId") REFERENCES "region"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // 3. Create destination_region join table
    await queryRunner.query(
      `CREATE TABLE "destination_region" ("destinationId" integer NOT NULL, "regionId" integer NOT NULL, CONSTRAINT "PK_destination_region" PRIMARY KEY ("destinationId", "regionId"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_destination_region_destinationId" ON "destination_region" ("destinationId")`);
    await queryRunner.query(`CREATE INDEX "IDX_destination_region_regionId" ON "destination_region" ("regionId")`);
    await queryRunner.query(
      `ALTER TABLE "destination_region" ADD CONSTRAINT "FK_destination_region_destination" FOREIGN KEY ("destinationId") REFERENCES "destination"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "destination_region" ADD CONSTRAINT "FK_destination_region_region" FOREIGN KEY ("regionId") REFERENCES "region"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    // 4. Create plan table
    await queryRunner.query(
      `CREATE TABLE "plan" ("id" SERIAL NOT NULL, "destinationId" integer NOT NULL, "name" character varying NOT NULL, "slug" character varying NOT NULL, "dataAmount" character varying NOT NULL, "duration" integer NOT NULL, "description" character varying, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_plan_slug" UNIQUE ("slug"), CONSTRAINT "PK_plan" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_plan_destinationId" ON "plan" ("destinationId")`);
    await queryRunner.query(`CREATE INDEX "IDX_plan_name" ON "plan" ("name")`);
    await queryRunner.query(
      `ALTER TABLE "plan" ADD CONSTRAINT "FK_plan_destination" FOREIGN KEY ("destinationId") REFERENCES "destination"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // 5. Create plan_price table
    await queryRunner.query(
      `CREATE TABLE "plan_price" ("id" SERIAL NOT NULL, "planId" integer NOT NULL, "currency" character varying(3) NOT NULL, "price" decimal(10,2) NOT NULL, "originalPrice" decimal(10,2), "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_plan_price" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_plan_price_planId" ON "plan_price" ("planId")`);
    await queryRunner.query(
      `ALTER TABLE "plan_price" ADD CONSTRAINT "FK_plan_price_plan" FOREIGN KEY ("planId") REFERENCES "plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // 6. Create order table
    await queryRunner.query(
      `CREATE TABLE "order" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "orderNumber" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "totalAmount" decimal(10,2) NOT NULL, "currency" character varying(3) NOT NULL, "paymentMethod" character varying, "paymentId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_order_orderNumber" UNIQUE ("orderNumber"), CONSTRAINT "PK_order" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_order_userId" ON "order" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_order_orderNumber" ON "order" ("orderNumber")`);
    await queryRunner.query(`CREATE INDEX "IDX_order_status" ON "order" ("status")`);
    await queryRunner.query(
      `ALTER TABLE "order" ADD CONSTRAINT "FK_order_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // 7. Create order_item table
    await queryRunner.query(
      `CREATE TABLE "order_item" ("id" SERIAL NOT NULL, "orderId" integer NOT NULL, "planId" integer NOT NULL, "planPriceId" integer NOT NULL, "price" decimal(10,2) NOT NULL, "currency" character varying(3) NOT NULL, "quantity" integer NOT NULL DEFAULT 1, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_order_item" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_order_item_orderId" ON "order_item" ("orderId")`);
    await queryRunner.query(`CREATE INDEX "IDX_order_item_planId" ON "order_item" ("planId")`);
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD CONSTRAINT "FK_order_item_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD CONSTRAINT "FK_order_item_plan" FOREIGN KEY ("planId") REFERENCES "plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD CONSTRAINT "FK_order_item_plan_price" FOREIGN KEY ("planPriceId") REFERENCES "plan_price"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // 8. Create esim table
    await queryRunner.query(
      `CREATE TABLE "esim" ("id" SERIAL NOT NULL, "orderItemId" integer, "userId" integer, "iccid" character varying NOT NULL, "smdpAddress" character varying, "activationCode" character varying, "status" character varying NOT NULL DEFAULT 'available', "dataUsed" character varying, "dataTotal" character varying, "expiresAt" TIMESTAMP, "activatedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_esim_iccid" UNIQUE ("iccid"), CONSTRAINT "PK_esim" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_esim_userId" ON "esim" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_esim_status" ON "esim" ("status")`);
    await queryRunner.query(
      `ALTER TABLE "esim" ADD CONSTRAINT "FK_esim_order_item" FOREIGN KEY ("orderItemId") REFERENCES "order_item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" ADD CONSTRAINT "FK_esim_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // 9. Create provider_sync_log table
    await queryRunner.query(
      `CREATE TABLE "provider_sync_log" ("id" SERIAL NOT NULL, "provider" character varying NOT NULL, "syncType" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'started', "itemsSynced" integer, "errorMessage" character varying, "startedAt" TIMESTAMP NOT NULL, "completedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_provider_sync_log" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_provider_sync_log_provider" ON "provider_sync_log" ("provider")`);
    await queryRunner.query(`CREATE INDEX "IDX_provider_sync_log_syncType" ON "provider_sync_log" ("syncType")`);
    await queryRunner.query(`CREATE INDEX "IDX_provider_sync_log_status" ON "provider_sync_log" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order
    await queryRunner.query(`DROP INDEX "IDX_provider_sync_log_status"`);
    await queryRunner.query(`DROP INDEX "IDX_provider_sync_log_syncType"`);
    await queryRunner.query(`DROP INDEX "IDX_provider_sync_log_provider"`);
    await queryRunner.query(`DROP TABLE "provider_sync_log"`);

    await queryRunner.query(`ALTER TABLE "esim" DROP CONSTRAINT "FK_esim_user"`);
    await queryRunner.query(`ALTER TABLE "esim" DROP CONSTRAINT "FK_esim_order_item"`);
    await queryRunner.query(`DROP INDEX "IDX_esim_status"`);
    await queryRunner.query(`DROP INDEX "IDX_esim_userId"`);
    await queryRunner.query(`DROP TABLE "esim"`);

    await queryRunner.query(`ALTER TABLE "order_item" DROP CONSTRAINT "FK_order_item_plan_price"`);
    await queryRunner.query(`ALTER TABLE "order_item" DROP CONSTRAINT "FK_order_item_plan"`);
    await queryRunner.query(`ALTER TABLE "order_item" DROP CONSTRAINT "FK_order_item_order"`);
    await queryRunner.query(`DROP INDEX "IDX_order_item_planId"`);
    await queryRunner.query(`DROP INDEX "IDX_order_item_orderId"`);
    await queryRunner.query(`DROP TABLE "order_item"`);

    await queryRunner.query(`ALTER TABLE "order" DROP CONSTRAINT "FK_order_user"`);
    await queryRunner.query(`DROP INDEX "IDX_order_status"`);
    await queryRunner.query(`DROP INDEX "IDX_order_orderNumber"`);
    await queryRunner.query(`DROP INDEX "IDX_order_userId"`);
    await queryRunner.query(`DROP TABLE "order"`);

    await queryRunner.query(`ALTER TABLE "plan_price" DROP CONSTRAINT "FK_plan_price_plan"`);
    await queryRunner.query(`DROP INDEX "IDX_plan_price_planId"`);
    await queryRunner.query(`DROP TABLE "plan_price"`);

    await queryRunner.query(`ALTER TABLE "plan" DROP CONSTRAINT "FK_plan_destination"`);
    await queryRunner.query(`DROP INDEX "IDX_plan_name"`);
    await queryRunner.query(`DROP INDEX "IDX_plan_destinationId"`);
    await queryRunner.query(`DROP TABLE "plan"`);

    await queryRunner.query(`ALTER TABLE "destination_region" DROP CONSTRAINT "FK_destination_region_region"`);
    await queryRunner.query(`ALTER TABLE "destination_region" DROP CONSTRAINT "FK_destination_region_destination"`);
    await queryRunner.query(`DROP INDEX "IDX_destination_region_regionId"`);
    await queryRunner.query(`DROP INDEX "IDX_destination_region_destinationId"`);
    await queryRunner.query(`DROP TABLE "destination_region"`);

    await queryRunner.query(`ALTER TABLE "region" DROP CONSTRAINT "FK_region_parent"`);
    await queryRunner.query(`DROP INDEX "IDX_region_isActive"`);
    await queryRunner.query(`DROP INDEX "IDX_region_name"`);
    await queryRunner.query(`DROP TABLE "region"`);

    // Restore continent and region columns on destination
    await queryRunner.query(`ALTER TABLE "destination" ADD "continent" character varying NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "destination" ADD "region" character varying`);
    await queryRunner.query(`CREATE INDEX "IDX_destination_continent" ON "destination" ("continent")`);
  }
}
