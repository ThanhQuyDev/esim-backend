import { User } from '../../users/domain/user';
import { ApiProperty } from '@nestjs/swagger';

export class CustomPaymentLink {
  @ApiProperty({
    type: () => Number,
    nullable: true,
  })
  createdById?: number | null;

  @ApiProperty({
    type: () => User,
    nullable: true,
  })
  createdBy?: User | null;

  @ApiProperty({
    type: () => String,
    nullable: true,
  })
  paymentId?: string | null;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  status: string;

  @ApiProperty({
    type: () => String,
    nullable: true,
  })
  paymentUrl?: string | null;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  description: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  currency: string;

  @ApiProperty({
    type: () => Number,
    nullable: false,
  })
  amount: number;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  customerEmail: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  virtualOrderId: string;

  @ApiProperty({
    type: String,
  })
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
