import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  Min,
  MaxLength,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitOrderInvoiceDto {
  @ApiProperty({ example: 'Công ty TNHH ABC', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  companyName!: string;

  @ApiProperty({ example: '0312345678', maxLength: 32 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  taxCode!: string;

  @ApiProperty({
    example: '123 Nguyen Hue, District 1, Ho Chi Minh City',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;

  @ApiProperty({ example: 'finance@example.com' })
  @IsEmail()
  @IsNotEmpty()
  invoiceEmail!: string;
}

export class SubmitOrderItemDto {
  @ApiProperty({ type: Number, description: 'Plan ID from the plans table' })
  @IsNotEmpty()
  @IsNumber()
  planId!: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    type: Number,
    example: 7,
    description:
      'Number of days for multidate plans (only when plan.isAbleMultidate is true)',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  periodNum?: number;
}

export class SubmitOrderDto {
  @ApiPropertyOptional({ type: String, example: 'stripe' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ type: String, example: 'pi_xxx' })
  @IsOptional()
  @IsString()
  paymentId?: string;

  @ApiProperty({ example: 'USD', type: String })
  @IsNotEmpty()
  @IsString()
  @MaxLength(3)
  currency!: string;

  @ApiProperty({ type: [SubmitOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitOrderItemDto)
  items!: SubmitOrderItemDto[];

  @ApiPropertyOptional({ type: String, example: 'SUMMER10' })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ type: String, example: 'EXU123ABC' })
  @IsOptional()
  @IsString()
  referralCode?: string;

  @ApiPropertyOptional({
    type: String,
    example: '+84901234567',
    description: 'Phone number for contact. Saved to user profile if not set.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'buyer@example.com',
    description: 'Buyer email for order confirmation.',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ type: Number, example: 20000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  useWalletAmountVnd?: number;

  @ApiPropertyOptional({
    type: () => SubmitOrderInvoiceDto,
    description:
      'Optional financial invoice details. When provided, the system will create a PENDING invoice linked 1:1 with the order. Customers tick "Xuất hóa đơn" at checkout to populate this.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SubmitOrderInvoiceDto)
  invoice?: SubmitOrderInvoiceDto;

  @ApiPropertyOptional({
    type: String,
    example: 'vi',
    description:
      'UI locale at checkout ("vi" | "en"). Controls OnePay gateway language and which localized result page the buyer returns to.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  locale?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'https://esim.vn/thanh-toan/ket-qua',
    description:
      'Absolute URL OnePay redirects to after payment. Must be on the configured frontend domain; otherwise it is ignored and the default env return URL is used. Lets the buyer land on the result page in their current language.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  returnUrl?: string;
}
