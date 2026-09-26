import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentLinkEventsTable1751300000005 implements MigrationInterface {
  name = 'CreatePaymentLinkEventsTable1751300000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "payment_link_event_type_enum" AS ENUM ('VIEW', 'REDEEM', 'COMPLETE')
    `);

    await queryRunner.query(`
      CREATE TABLE "payment_link_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "paymentLinkId" uuid NOT NULL,
        "type" "payment_link_event_type_enum" NOT NULL,
        "ipHash" varchar(64) NOT NULL,
        "userAgent" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_payment_link_events_link" 
          FOREIGN KEY ("paymentLinkId") REFERENCES "payment_links"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_payment_link_events_link_id" ON "payment_link_events" ("paymentLinkId")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_payment_link_events_created_at" ON "payment_link_events" ("createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_payment_link_events_link_created" 
      ON "payment_link_events" ("paymentLinkId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "payment_link_events"`);
    await queryRunner.query(`DROP TYPE "payment_link_event_type_enum"`);
  }
}