import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTransactionHashToSettlements1754900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'settlements',
      new TableColumn({ name: 'transactionHash', type: 'varchar', isNullable: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('settlements', 'transactionHash');
  }
}