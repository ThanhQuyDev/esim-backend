import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPeriodNumToCart1778400000000 implements MigrationInterface {
  name = 'AddPeriodNumToCart1778400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'cart',
      new TableColumn({
        name: 'periodNum',
        type: 'int',
        isNullable: true,
        default: null,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('cart', 'periodNum');
  }
}
