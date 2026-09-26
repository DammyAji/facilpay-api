import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCheckoutSessionsTable1751300000004 implements MigrationInterface {
  name = 'CreateCheckoutSessionsTable1751300000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "checkout_session_status_enum" AS ENUM ('OPEN', 'COMPLETE', 'EXPIRED')
    `);

    await queryRunner.query(`
      CREATE TABLE "checkout_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "publicId" varchar(32) NOT NULL,
        "merchantId" uuid NOT NULL,
        "lineItems" jsonb NOT NULL DEFAULT '[]',
        "currency" varchar(3) NOT NULL,
        "total" decimal(10,2) NOT NULL,
        "customerId" varchar(200),
        "customerEmail" varchar(255),
        "successUrl" text NOT NULL,
        "cancelUrl" text NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "status" "checkout_session_status_enum" NOT NULL DEFAULT 'OPEN',
        "paymentId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "idx_checkout_sessions_merchant_id" UNIQUE ("merchantId"),
        CONSTRAINT "idx_checkout_sessions_public_id" UNIQUE ("publicId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_checkout_sessions_merchant_id" ON "checkout_sessions" ("merchantId")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_checkout_sessions_public_id" ON "checkout_sessions" ("publicId")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_checkout_sessions_status" ON "checkout_sessions" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_checkout_sessions_expires_at" ON "checkout_sessions" ("expiresAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "checkout_sessions"`);
    await queryRunner.query(`DROP TYPE "checkout_session_status_enum"`);
  }
}