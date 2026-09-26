import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebhookEventReplays1763000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "webhook_deliveries"
      ADD COLUMN "replayId" uuid
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_webhook_deliveries_replayId" ON "webhook_deliveries" ("replayId")`,
    );
    await queryRunner.query(`
      CREATE TABLE "webhook_replays" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "endpointId" uuid NOT NULL,
        "merchantId" uuid NOT NULL,
        "totalEvents" integer NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'processing',
        "failureReason" text,
        "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_webhook_replays" PRIMARY KEY ("id"),
        CONSTRAINT "FK_webhook_replays_endpoint"
          FOREIGN KEY ("endpointId")
          REFERENCES "webhook_endpoints"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_webhook_replays_merchant_createdAt" ON "webhook_replays" ("merchantId", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "webhook_replays"`);
    await queryRunner.query(`DROP INDEX "IDX_webhook_deliveries_replayId"`);
    await queryRunner.query(`
      ALTER TABLE "webhook_deliveries"
      DROP COLUMN "replayId"
    `);
  }
}