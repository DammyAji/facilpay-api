import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMaxCompletionsToPaymentLinks1754800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "maxCompletions" integer NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "payment_links" DROP COLUMN IF EXISTS "maxCompletions"',
    );
  }
}