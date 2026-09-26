import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecurringPaymentTrials1761000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "recurring_payments_status_enum" ADD VALUE IF NOT EXISTS 'trialing'`,
    );
    await queryRunner.query(`
      ALTER TABLE "recurring_payments"
      ADD COLUMN "trialDays" integer NOT NULL DEFAULT 0,
      ADD COLUMN "trialEndsAt" timestamp,
      ADD COLUMN "trialEndingNotifiedAt" timestamp
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "recurring_payments"
      SET "status" = 'active'
      WHERE "status" = 'trialing'
    `);
    await queryRunner.query(`
      ALTER TABLE "recurring_payments"
      DROP COLUMN "trialEndingNotifiedAt",
      DROP COLUMN "trialEndsAt",
      DROP COLUMN "trialDays"
    `);
  }
}