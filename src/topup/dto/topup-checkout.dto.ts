import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TopupProvider } from './topup-package.dto';

export enum TopupPaymentMethod {
  ONEPAY = 'ONEPAY',
  /** Paid out of the customer's eXu balance, with no gateway (#028). */
  EXU_WALLET = 'EXU_WALLET',
}

/** `order.paymentMethod` for a topup settled from the eXu balance (#028). */
export const EXU_WALLET_PAYMENT_METHOD = 'exu_wallet';

/**
 * VAT invoice details for a topup (#028), the same five fields the normal eSIM
 * checkout collects. Optional: most customers do not ask for an invoice.
 */
export class TopupInvoiceDto {
  @ApiProperty({ type: String, example: 'Công ty TNHH ABC' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  companyName!: string;

  @ApiProperty({ type: String, example: '0123456789' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  taxCode!: string;

  @ApiProperty({ type: String, example: '123 Nguyễn Huệ, Q1, TP.HCM' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;

  @ApiProperty({ type: String, example: '+84901234567' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  invoicePhone!: string;

  @ApiProperty({ type: String, example: 'finance@example.com' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  invoiceEmail!: string;
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

  @ApiPropertyOptional({ type: () => TopupInvoiceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TopupInvoiceDto)
  invoice?: TopupInvoiceDto;
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
