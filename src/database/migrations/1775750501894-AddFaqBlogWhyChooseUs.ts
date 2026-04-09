import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFaqBlogWhyChooseUs1775750501894 implements MigrationInterface {
  name = 'AddFaqBlogWhyChooseUs1775750501894';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "region" DROP CONSTRAINT "FK_region_parent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" DROP CONSTRAINT "FK_plan_region"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" DROP CONSTRAINT "FK_plan_destination"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan_price" DROP CONSTRAINT "FK_plan_price_plan"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP CONSTRAINT "FK_order_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP CONSTRAINT "FK_order_item_plan_price"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP CONSTRAINT "FK_order_item_plan"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP CONSTRAINT "FK_order_item_order"`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" DROP CONSTRAINT "FK_esim_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" DROP CONSTRAINT "FK_esim_order_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "destination_region" DROP CONSTRAINT "FK_destination_region_region"`,
    );
    await queryRunner.query(
      `ALTER TABLE "destination_region" DROP CONSTRAINT "FK_destination_region_destination"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_destination_name"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_destination_isPopular"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_destination_isActive"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_destination_countryCode"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_region_name"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_region_isActive"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_provider_sync_log_provider"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_provider_sync_log_syncType"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_provider_sync_log_status"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_plan_destinationId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_plan_name"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_plan_provider"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_plan_countryCode"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_plan_regionId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_plan_price_planId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_profit_margin_isActive"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_order_userId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_order_orderNumber"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_order_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_order_item_orderId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_order_item_planId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_esim_userId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_esim_status"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_destination_region_destinationId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_destination_region_regionId"`,
    );
    await queryRunner.query(
      `CREATE TABLE "why_choose_us" ("language" character varying NOT NULL, "isActive" boolean NOT NULL, "sortOrder" integer NOT NULL, "icon" character varying, "description" character varying NOT NULL, "title" character varying NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4d0ef28c2281929617c9f141ed8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "faq" ("language" character varying NOT NULL, "isActive" boolean NOT NULL, "sortOrder" integer NOT NULL, "answer" character varying NOT NULL, "question" character varying NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d6f5a52b1a96dd8d0591f9fbc47" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "blog" ("language" character varying NOT NULL, "publishedAt" TIMESTAMP, "isPublished" boolean NOT NULL, "author" character varying, "tags" character varying, "coverImage" character varying, "excerpt" character varying, "content" character varying NOT NULL, "slug" character varying NOT NULL, "title" character varying NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_85c6532ad065a448e9de7638571" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`ALTER TABLE "region" DROP COLUMN "parentId"`);
    await queryRunner.query(
      `ALTER TABLE "plan" ALTER COLUMN "provider" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ALTER COLUMN "providerPlanId" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ALTER COLUMN "durationDays" DROP DEFAULT`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8a962921d15e2f4cfa8eba6748" ON "destination" ("name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_473792dc28362b7909bcacf1bf" ON "destination" ("countryCode") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_86d27d386fc3befc8873f8bc0c" ON "destination" ("isPopular") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_78886f707bd0b777fd2c8ab97a" ON "destination" ("isActive") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8d766fc1d4d2e72ecd5f6567a0" ON "region" ("name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6bf94b3a2b8d46110155d9291e" ON "region" ("isActive") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_34944375178ab3cd8e9034b9d7" ON "provider_sync_log" ("provider") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3bdf15072ee1c846a13ad4e9e0" ON "provider_sync_log" ("syncType") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_39b54332c2bfcd3661bebe985c" ON "provider_sync_log" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_50cbba17934ccbdbf89c0db5dc" ON "plan" ("provider") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a26034d382d739329b576ea451" ON "plan" ("countryCode") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_836f00f637eebce1d16c82f998" ON "plan" ("destinationId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e75af48321c9729ec99ed447a0" ON "plan" ("regionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2be48bccbdc8b55af6445a80b5" ON "plan" ("isActive") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_227bda0a542cd5cfeb2cdd202f" ON "plan_price" ("planId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5ef3576dd8505e8a10f833380d" ON "plan_price" ("isActive") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cf11fa36c42006d36ba8641f50" ON "profit_margin" ("isActive") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_caabe91507b3379c7ba73637b8" ON "order" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4e9f8dd16ec084bca97b3262ed" ON "order" ("orderNumber") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7a9573d6a1fb982772a9123320" ON "order" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_646bf9ece6f45dbe41c203e06e" ON "order_item" ("orderId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0ac6a35e72907ee68fe97b283c" ON "order_item" ("planId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_caca67ef13a4cbca2988d53275" ON "esim" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c09cd50420a8a538b1d3a821cb" ON "esim" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3d4bfd382c26ba3dfdce6ead99" ON "destination_region" ("destinationId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1ef63fb8059dc20c042fc756d9" ON "destination_region" ("regionId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD CONSTRAINT "FK_836f00f637eebce1d16c82f9989" FOREIGN KEY ("destinationId") REFERENCES "destination"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD CONSTRAINT "FK_e75af48321c9729ec99ed447a04" FOREIGN KEY ("regionId") REFERENCES "region"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan_price" ADD CONSTRAINT "FK_227bda0a542cd5cfeb2cdd202f1" FOREIGN KEY ("planId") REFERENCES "plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD CONSTRAINT "FK_caabe91507b3379c7ba73637b84" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD CONSTRAINT "FK_646bf9ece6f45dbe41c203e06e0" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD CONSTRAINT "FK_0ac6a35e72907ee68fe97b283cc" FOREIGN KEY ("planId") REFERENCES "plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD CONSTRAINT "FK_551de7370362539fee7e58633d8" FOREIGN KEY ("planPriceId") REFERENCES "plan_price"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" ADD CONSTRAINT "FK_7e25da06b18d10864da92e389ab" FOREIGN KEY ("orderItemId") REFERENCES "order_item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" ADD CONSTRAINT "FK_caca67ef13a4cbca2988d532753" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "destination_region" ADD CONSTRAINT "FK_3d4bfd382c26ba3dfdce6ead99a" FOREIGN KEY ("destinationId") REFERENCES "destination"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "destination_region" ADD CONSTRAINT "FK_1ef63fb8059dc20c042fc756d9d" FOREIGN KEY ("regionId") REFERENCES "region"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "destination_region" DROP CONSTRAINT "FK_1ef63fb8059dc20c042fc756d9d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "destination_region" DROP CONSTRAINT "FK_3d4bfd382c26ba3dfdce6ead99a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" DROP CONSTRAINT "FK_caca67ef13a4cbca2988d532753"`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" DROP CONSTRAINT "FK_7e25da06b18d10864da92e389ab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP CONSTRAINT "FK_551de7370362539fee7e58633d8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP CONSTRAINT "FK_0ac6a35e72907ee68fe97b283cc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP CONSTRAINT "FK_646bf9ece6f45dbe41c203e06e0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP CONSTRAINT "FK_caabe91507b3379c7ba73637b84"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan_price" DROP CONSTRAINT "FK_227bda0a542cd5cfeb2cdd202f1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" DROP CONSTRAINT "FK_e75af48321c9729ec99ed447a04"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" DROP CONSTRAINT "FK_836f00f637eebce1d16c82f9989"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1ef63fb8059dc20c042fc756d9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3d4bfd382c26ba3dfdce6ead99"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c09cd50420a8a538b1d3a821cb"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_caca67ef13a4cbca2988d53275"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0ac6a35e72907ee68fe97b283c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_646bf9ece6f45dbe41c203e06e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7a9573d6a1fb982772a9123320"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4e9f8dd16ec084bca97b3262ed"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_caabe91507b3379c7ba73637b8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cf11fa36c42006d36ba8641f50"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5ef3576dd8505e8a10f833380d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_227bda0a542cd5cfeb2cdd202f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2be48bccbdc8b55af6445a80b5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e75af48321c9729ec99ed447a0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_836f00f637eebce1d16c82f998"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a26034d382d739329b576ea451"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_50cbba17934ccbdbf89c0db5dc"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_39b54332c2bfcd3661bebe985c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3bdf15072ee1c846a13ad4e9e0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_34944375178ab3cd8e9034b9d7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6bf94b3a2b8d46110155d9291e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8d766fc1d4d2e72ecd5f6567a0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_78886f707bd0b777fd2c8ab97a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_86d27d386fc3befc8873f8bc0c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_473792dc28362b7909bcacf1bf"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8a962921d15e2f4cfa8eba6748"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ALTER COLUMN "durationDays" SET DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ALTER COLUMN "providerPlanId" SET DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ALTER COLUMN "provider" SET DEFAULT 'esimaccess'`,
    );
    await queryRunner.query(`ALTER TABLE "region" ADD "parentId" integer`);
    await queryRunner.query(`DROP TABLE "blog"`);
    await queryRunner.query(`DROP TABLE "faq"`);
    await queryRunner.query(`DROP TABLE "why_choose_us"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_destination_region_regionId" ON "destination_region" ("regionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_destination_region_destinationId" ON "destination_region" ("destinationId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_esim_status" ON "esim" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_esim_userId" ON "esim" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_item_planId" ON "order_item" ("planId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_item_orderId" ON "order_item" ("orderId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_status" ON "order" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_orderNumber" ON "order" ("orderNumber") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_userId" ON "order" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_profit_margin_isActive" ON "profit_margin" ("isActive") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_plan_price_planId" ON "plan_price" ("planId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_plan_regionId" ON "plan" ("regionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_plan_countryCode" ON "plan" ("countryCode") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_plan_provider" ON "plan" ("provider") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_plan_name" ON "plan" ("name") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_plan_destinationId" ON "plan" ("destinationId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_provider_sync_log_status" ON "provider_sync_log" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_provider_sync_log_syncType" ON "provider_sync_log" ("syncType") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_provider_sync_log_provider" ON "provider_sync_log" ("provider") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_region_isActive" ON "region" ("isActive") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_region_name" ON "region" ("name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_destination_countryCode" ON "destination" ("countryCode") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_destination_isActive" ON "destination" ("isActive") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_destination_isPopular" ON "destination" ("isPopular") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_destination_name" ON "destination" ("name") `,
    );
    await queryRunner.query(
      `ALTER TABLE "destination_region" ADD CONSTRAINT "FK_destination_region_destination" FOREIGN KEY ("destinationId") REFERENCES "destination"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "destination_region" ADD CONSTRAINT "FK_destination_region_region" FOREIGN KEY ("regionId") REFERENCES "region"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" ADD CONSTRAINT "FK_esim_order_item" FOREIGN KEY ("orderItemId") REFERENCES "order_item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" ADD CONSTRAINT "FK_esim_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD CONSTRAINT "FK_order_item_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD CONSTRAINT "FK_order_item_plan" FOREIGN KEY ("planId") REFERENCES "plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD CONSTRAINT "FK_order_item_plan_price" FOREIGN KEY ("planPriceId") REFERENCES "plan_price"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD CONSTRAINT "FK_order_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan_price" ADD CONSTRAINT "FK_plan_price_plan" FOREIGN KEY ("planId") REFERENCES "plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD CONSTRAINT "FK_plan_destination" FOREIGN KEY ("destinationId") REFERENCES "destination"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD CONSTRAINT "FK_plan_region" FOREIGN KEY ("regionId") REFERENCES "region"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "region" ADD CONSTRAINT "FK_region_parent" FOREIGN KEY ("parentId") REFERENCES "region"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }
}
