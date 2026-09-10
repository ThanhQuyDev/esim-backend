import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { TopupProvider } from './topup-package.dto';

export enum TopupPaymentMethod {
  ONEPAY = 'ONEPAY',
}

/**
 * Payload for `POST /api/v1/topup/checkout`. Mirrors the spec exactly.
 */
export class TopupCheckoutDto {
  @ApiProperty({ type: String, example: '89852245280001354019' })
  @IsString()
  @IsNotEmpty()
  @Length(15, 22)
  iccid!: string;

  @ApiProperty({
    type: String,
    example: 'bonbon-mobile-30days-3gb-topup',
    description: 'Provider-specific package id from the list endpoint',
  })
  @IsString()
  @IsNotEmpty()
  packageId!: string;

  @ApiProperty({ enum: TopupProvider, example: TopupProvider.AIRALO })
  @IsEnum(TopupProvider)
  provider!: TopupProvider;

  @ApiProperty({
    enum: TopupPaymentMethod,
    example: TopupPaymentMethod.ONEPAY,
  })
  @IsEnum(TopupPaymentMethod)
  paymentMethod!: TopupPaymentMethod;
}

/**
 * Payload for `POST /api/v1/topup/admin/manual` — an admin topping an eSIM up
 * on the customer's behalf, without going through a payment gateway.
 */
export class AdminManualTopupDto {
  @ApiProperty({ type: String, example: '89852245280001354019' })
  @IsString()
  @IsNotEmpty()
  @Length(15, 22)
  iccid!: string;

  @ApiProperty({ type: String, example: 'bonbon-mobile-30days-3gb-topup' })
  @IsString()
  @IsNotEmpty()
  packageId!: string;

  @ApiProperty({ enum: TopupProvider, example: TopupProvider.AIRALO })
  @IsEnum(TopupProvider)
  provider!: TopupProvider;

  @ApiPropertyOptional({
    type: String,
    example: 'Khách chuyển khoản trực tiếp 12/09',
    description: 'Why this topup was granted without a gateway payment.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
