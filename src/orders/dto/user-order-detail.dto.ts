import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Esim } from '../../esims/domain/esim';

export class UserOrderItemPlanDto {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  slug: string;

  @ApiProperty({ type: Number })
  durationDays: number;

  @ApiProperty({ type: Number })
  dataMb: number;

  @ApiProperty({ type: Number })
  price: number;

  @ApiProperty({ type: Number })
  vndPrice: number;

  @ApiProperty({ type: String })
  currency: string;

  @ApiPropertyOptional({ type: String })
  speed: string | null;

  @ApiPropertyOptional({ type: String })
  operatorName: string | null;

  @ApiPropertyOptional({ type: String })
  countryCode: string | null;
}

export class UserOrderItemDto {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: Number })
  planId: number;

  @ApiPropertyOptional({ type: () => UserOrderItemPlanDto })
  plan?: UserOrderItemPlanDto | null;

  @ApiPropertyOptional({ type: String })
  orderRequestId: string | null;

  @ApiProperty({ type: String, example: 'pending' })
  status: string;

  @ApiProperty({ type: Number, example: 450000 })
  vndPrice: number;

  @ApiProperty({ type: Number, example: 1 })
  quantity: number;

  @ApiPropertyOptional({ type: () => [Esim] })
  esims?: Esim[];
}

export class UserOrderDetailDto {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String })
  orderNumber: string;

  @ApiProperty({ type: String, example: 'pending' })
  status: string;

  @ApiProperty({ type: Number, example: 450000 })
  vndPrice: number;

  @ApiPropertyOptional({ type: String })
  paymentMethod?: string | null;

  @ApiPropertyOptional({ type: String })
  couponCode?: string | null;

  @ApiProperty({ type: Number, example: 50000 })
  walletSpentVndAmount: number;

  @ApiProperty({ type: Number, example: 10000 })
  cashbackAmountVnd: number;

  @ApiProperty({ type: () => [UserOrderItemDto] })
  items: UserOrderItemDto[];

  @ApiProperty()
  createdAt: Date;
}
