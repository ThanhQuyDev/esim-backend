import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Esim } from '../../esims/domain/esim';
import { Coupon } from '../../coupons/domain/coupon';

export class AdminOrderUserDto {
  @ApiProperty({ type: Number })
  id: number | string;

  @ApiPropertyOptional({ type: String })
  email: string | null;

  @ApiPropertyOptional({ type: String })
  firstName: string | null;

  @ApiPropertyOptional({ type: String })
  lastName: string | null;
}

export class AdminOrderItemPlanDto {
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

  @ApiPropertyOptional({ type: String })
  provider: string | null;
}

export class AdminOrderItemDto {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: Number })
  planId: number;

  @ApiPropertyOptional({ type: () => AdminOrderItemPlanDto })
  plan?: AdminOrderItemPlanDto | null;

  @ApiPropertyOptional({ type: String })
  orderRequestId: string | null;

  @ApiPropertyOptional({ type: String })
  providerOrderId: string | null;

  @ApiPropertyOptional({ type: String })
  providerOrderCode: string | null;

  @ApiProperty({ type: String })
  status: string;

  @ApiProperty({ type: Number })
  price: number;

  @ApiProperty({ type: String })
  currency: string;

  @ApiProperty({ type: Number })
  quantity: number;

  @ApiProperty({ type: Number })
  vndPrice: number;

  @ApiProperty({ type: Number })
  vndCostPrice: number;

  @ApiPropertyOptional({ type: () => [Esim] })
  esims?: Esim[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class AdminOrderDetailDto {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: Number })
  userId: number;

  @ApiPropertyOptional({ type: () => AdminOrderUserDto })
  user?: AdminOrderUserDto | null;

  @ApiProperty({ type: String })
  orderNumber: string;

  @ApiProperty({ type: String })
  status: string;

  @ApiProperty({ type: Number })
  totalAmount: number;

  @ApiProperty({ type: String })
  currency: string;

  @ApiPropertyOptional({ type: String })
  paymentMethod?: string | null;

  @ApiPropertyOptional({ type: String })
  paymentId?: string | null;

  @ApiPropertyOptional({ type: String })
  couponCode?: string | null;

  @ApiProperty({ type: Number })
  discountAmount: number;

  @ApiProperty({ type: Number })
  vndPrice: number;

  @ApiProperty({ type: Number })
  vndCostPrice: number;

  @ApiProperty({ type: Number, example: 50000 })
  walletSpentVndAmount: number;

  @ApiProperty({ type: Number, example: 10000 })
  cashbackAmountVnd: number;

  @ApiPropertyOptional({ type: () => Coupon })
  coupon?: Coupon | null;

  @ApiProperty({ type: () => [AdminOrderItemDto] })
  items: AdminOrderItemDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
