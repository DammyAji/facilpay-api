import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMerchantBrandingTable1751300000000 implements MigrationInterface {
  name = 'CreateMerchantBrandingTable1751300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "merchant_branding" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "merchantId" uuid NOT NULL,
        "displayName" varchar(100),
        "logo" text,
        "primaryColor" varchar(7) NOT NULL DEFAULT '#1a1a2e',
        "supportEmail" text,
        "supportUrl" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "idx_merchant_branding_merchant_id" UNIQUE ("merchantId")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_merchant_branding_merchant_id" ON "merchant_branding" ("merchantId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "merchant_branding"`);
  }
}