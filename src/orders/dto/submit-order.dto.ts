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
}
