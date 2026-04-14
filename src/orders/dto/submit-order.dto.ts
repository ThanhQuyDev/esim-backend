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
} from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitOrderItemDto {
  @ApiProperty({ type: Number, description: 'Plan ID from the plans table' })
  @IsNotEmpty()
  @IsNumber()
  planId: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;
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
  currency: string;

  @ApiProperty({ type: [SubmitOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitOrderItemDto)
  items: SubmitOrderItemDto[];
}
