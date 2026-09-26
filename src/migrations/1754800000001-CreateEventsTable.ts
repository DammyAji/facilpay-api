import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEventsTable1754800000001 implements MigrationInterface {
  name = 'CreateEventsTable1754800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "merchantId" uuid,
        "type" varchar(128) NOT NULL,
        "payload" jsonb NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_events_merchant_id" ON "events" ("merchantId")`);
    await queryRunner.query(`CREATE INDEX "idx_events_type" ON "events" ("type")`);
    await queryRunner.query(`CREATE INDEX "idx_events_created_at" ON "events" ("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_events_created_at"`);
    await queryRunner.query(`DROP INDEX "idx_events_type"`);
    await queryRunner.query(`DROP INDEX "idx_events_merchant_id"`);
    await queryRunner.query(`DROP TABLE "events"`);
  }
}