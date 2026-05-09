import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
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
}
