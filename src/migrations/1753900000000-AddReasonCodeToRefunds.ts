import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReasonCodeToRefunds1753900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "refunds_reasonCode_enum" AS ENUM (
        'DUPLICATE',
        'FRAUDULENT',
        'REQUESTED_BY_CUSTOMER',
        'PRODUCT_NOT_RECEIVED',
        'PRODUCT_UNACCEPTABLE',
        'OTHER'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "refunds"
      ADD COLUMN "reasonCode" "refunds_reasonCode_enum" NOT NULL DEFAULT 'OTHER'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "refunds" DROP COLUMN "reasonCode"`);
    await queryRunner.query(`DROP TYPE "refunds_reasonCode_enum"`);
  }
}