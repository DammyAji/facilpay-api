import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMerchantSettingsTable1751300000001 implements MigrationInterface {
  name = 'CreateMerchantSettingsTable1751300000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "merchant_settings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "merchantId" uuid NOT NULL,
        "remindersEnabled" boolean NOT NULL DEFAULT true,
        "reminderOffsets" integer[] NOT NULL DEFAULT '{-3,0,7}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "idx_merchant_settings_merchant_id" UNIQUE ("merchantId")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_merchant_settings_merchant_id" ON "merchant_settings" ("merchantId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "merchant_settings"`);
  }
}