import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInvoiceRemindersTable1751300000003 implements MigrationInterface {
  name = 'CreateInvoiceRemindersTable1751300000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "invoice_reminder_type_enum" AS ENUM ('BEFORE', 'ON_DUE', 'AFTER')
    `);

    await queryRunner.query(`
      CREATE TABLE "invoice_reminders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "paymentId" uuid NOT NULL,
        "type" "invoice_reminder_type_enum" NOT NULL,
        "sentAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_invoice_reminders_payment" 
          FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_invoice_reminders_payment_type" 
      ON "invoice_reminders" ("paymentId", "type")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_invoice_reminders_payment_id" 
      ON "invoice_reminders" ("paymentId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "invoice_reminders"`);
    await queryRunner.query(`DROP TYPE "invoice_reminder_type_enum"`);
  }
}