import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecurringPaymentNotificationFields1754800000000 implements MigrationInterface {
  name = 'AddRecurringPaymentNotificationFields1754800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "recurring_payments"
      ADD COLUMN "notifyDaysBefore" integer NOT NULL DEFAULT 3
    `);
    await queryRunner.query(`
      ALTER TABLE "recurring_payments"
      ADD COLUMN "lastNotifiedCycle" integer
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "recurring_payments" DROP COLUMN "lastNotifiedCycle"`);
    await queryRunner.query(`ALTER TABLE "recurring_payments" DROP COLUMN "notifyDaysBefore"`);
  }
}