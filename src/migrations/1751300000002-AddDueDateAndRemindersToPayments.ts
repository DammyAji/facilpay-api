import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDueDateAndRemindersToPayments1751300000002 implements MigrationInterface {
  name = 'AddDueDateAndRemindersToPayments1751300000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add dueDate column
    await queryRunner.query(`
      ALTER TABLE "payments" 
      ADD COLUMN "dueDate" TIMESTAMP
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_payments_due_date" ON "payments" ("dueDate")
    `);

    // Add remindersEnabled column
    await queryRunner.query(`
      ALTER TABLE "payments" 
      ADD COLUMN "remindersEnabled" boolean NOT NULL DEFAULT true
    `);

    // Add OVERDUE to payment status enum
    await queryRunner.query(`
      ALTER TYPE "payment_status_enum" ADD VALUE IF NOT EXISTS 'OVERDUE'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_payments_due_date"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "dueDate"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "remindersEnabled"`);
    // Note: Cannot remove enum value in PostgreSQL easily
  }
}