import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebhookEndpointFailureTracking1754800000002 implements MigrationInterface {
  name = 'AddWebhookEndpointFailureTracking1754800000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "webhook_endpoints"
      ADD COLUMN "consecutiveFailures" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "webhook_endpoints"
      ADD COLUMN "lastFailureAt" timestamp
    `);
    await queryRunner.query(`
      ALTER TABLE "webhook_endpoints"
      ADD COLUMN "disabledReason" varchar(64)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "webhook_endpoints" DROP COLUMN "disabledReason"`);
    await queryRunner.query(`ALTER TABLE "webhook_endpoints" DROP COLUMN "lastFailureAt"`);
    await queryRunner.query(`ALTER TABLE "webhook_endpoints" DROP COLUMN "consecutiveFailures"`);
  }
}