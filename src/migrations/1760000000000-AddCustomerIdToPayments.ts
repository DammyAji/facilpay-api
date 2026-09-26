import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddCustomerIdToPayments1760000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'payments',
      new TableColumn({
        name: 'customerId',
        type: 'varchar',
        length: '200',
        isNullable: true,
      }),
    );
    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        name: 'IDX_payments_customerId_createdAt',
        columnNames: ['customerId', 'createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('payments', 'IDX_payments_customerId_createdAt');
    await queryRunner.dropColumn('payments', 'customerId');
  }
}