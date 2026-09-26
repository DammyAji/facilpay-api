import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReportSubscriptionsTable1754000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "report_subscriptions_frequency_enum" AS ENUM (
        'DAILY',
        'WEEKLY',
        'MONTHLY'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "report_subscriptions" (
        "id"          uuid NOT NULL DEFAULT gen_random_uuid(),
        "merchantId"  character varying NOT NULL,
        "frequency"   "report_subscriptions_frequency_enum" NOT NULL DEFAULT 'DAILY',
        "recipients"  text[] NOT NULL,
        "timezone"    character varying NOT NULL DEFAULT 'UTC',
        "includeCsv"  boolean NOT NULL DEFAULT false,
        "isActive"    boolean NOT NULL DEFAULT true,
        "lastSentAt"  timestamp,
        "createdAt"   timestamp NOT NULL DEFAULT now(),
        "updatedAt"   timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_subscriptions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_report_subscriptions_merchantId"
        ON "report_subscriptions" ("merchantId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_report_subscriptions_merchantId"`,
    );
    await queryRunner.query(`DROP TABLE "report_subscriptions"`);
    await queryRunner.query(
      `DROP TYPE "report_subscriptions_frequency_enum"`,
    );
  }
}
