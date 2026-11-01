import { Order } from '../../orders/domain/order';
import { ApiProperty } from '@nestjs/swagger';

export class Invoice {
  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  status: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  invoicePhone: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  invoiceEmail: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  address: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  taxCode: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  companyName: string;

  /** "Số hóa đơn VAT" (doitac-3010 #044). */
  @ApiProperty({ type: String, nullable: true, example: '0001234' })
  invoiceNumber?: string | null;

  /** `company` or `consumer` (doitac-3010 #044). */
  @ApiProperty({ type: String, example: 'company' })
  buyerType?: string;

  @ApiProperty({ type: Number, nullable: false })
  orderId: number;

  @ApiProperty({
    type: () => Order,
    nullable: false,
  })
  order: Order;

  @ApiProperty({
    type: String,
  })
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
