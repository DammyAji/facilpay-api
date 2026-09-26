import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class CreatePayoutDestinations1754800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'payout_destinations',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'merchantId', type: 'uuid' },
          { name: 'label', type: 'varchar', length: '100' },
          { name: 'stellarAddress', type: 'varchar', length: '56' },
          { name: 'assetCode', type: 'varchar', length: '12' },
          { name: 'isDefault', type: 'boolean', default: false },
          { name: 'verifiedAt', type: 'timestamptz', isNullable: true },
          { name: 'coolingOffUntil', type: 'timestamptz', isNullable: true },
          { name: 'verificationTokenHash', type: 'varchar', length: '128', isNullable: true },
          { name: 'verificationTokenExpiresAt', type: 'timestamptz', isNullable: true },
          { name: 'createdAt', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createIndex(
      'payout_destinations',
      new TableIndex({
        name: 'UQ_payout_destinations_merchant_asset_address',
        columnNames: ['merchantId', 'assetCode', 'stellarAddress'],
        isUnique: true,
      }),
    );

    await queryRunner.addColumn(
      'merchant_settlement_configs',
      new TableColumn({ name: 'destinationId', type: 'uuid', isNullable: true }),
    );

    await queryRunner.addColumn(
      'settlements',
      new TableColumn({ name: 'payoutDestinationId', type: 'uuid', isNullable: true }),
    );

    await queryRunner.createForeignKey(
      'merchant_settlement_configs',
      new TableForeignKey({
        name: 'FK_merchant_settlement_configs_destination',
        columnNames: ['destinationId'],
        referencedTableName: 'payout_destinations',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'settlements',
      new TableForeignKey({
        name: 'FK_settlements_payout_destination',
        columnNames: ['payoutDestinationId'],
        referencedTableName: 'payout_destinations',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('settlements', 'FK_settlements_payout_destination');
    await queryRunner.dropColumn('settlements', 'payoutDestinationId');
    await queryRunner.dropForeignKey('merchant_settlement_configs', 'FK_merchant_settlement_configs_destination');
    await queryRunner.dropColumn('merchant_settlement_configs', 'destinationId');
    await queryRunner.dropTable('payout_destinations');
  }
}