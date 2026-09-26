import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecurringPaymentCharges1762000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments"
      ADD COLUMN "recurringPaymentId" uuid,
      ADD CONSTRAINT "FK_payments_recurringPaymentId_recurring_payments"
        FOREIGN KEY ("recurringPaymentId")
        REFERENCES "recurring_payments"("id")
        ON DELETE SET NULL
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_payments_recurringPaymentId" ON "payments" ("recurringPaymentId")`,
    );
    await queryRunner.query(`
      CREATE TABLE "recurring_payment_charges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "recurringPaymentId" uuid NOT NULL,
        "cycleNumber" integer NOT NULL,
        "paymentId" uuid,
        "amount" decimal(10, 2) NOT NULL,
        "status" varchar(20) NOT NULL,
        "failureReason" text,
        "attemptedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_recurring_payment_charges" PRIMARY KEY ("id"),
        CONSTRAINT "FK_recurring_payment_charges_plan"
          FOREIGN KEY ("recurringPaymentId")
          REFERENCES "recurring_payments"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_recurring_payment_charges_payment"
          FOREIGN KEY ("paymentId")
          REFERENCES "payments"("id")
          ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_recurring_payment_charges_plan_attempted" ON "recurring_payment_charges" ("recurringPaymentId", "attemptedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "recurring_payment_charges"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_recurringPaymentId"`);
    await queryRunner.query(`
      ALTER TABLE "payments"
      DROP CONSTRAINT "FK_payments_recurringPaymentId_recurring_payments",
      DROP COLUMN "recurringPaymentId"
    `);
  }
}