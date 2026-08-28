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
