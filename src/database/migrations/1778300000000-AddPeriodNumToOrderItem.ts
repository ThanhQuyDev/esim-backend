import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPeriodNumToOrderItem1778300000000 implements MigrationInterface {
  name = 'AddPeriodNumToOrderItem1778300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'order_item',
      new TableColumn({
        name: 'periodNum',
        type: 'int',
        isNullable: true,
        default: null,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('order_item', 'periodNum');
  }
}
