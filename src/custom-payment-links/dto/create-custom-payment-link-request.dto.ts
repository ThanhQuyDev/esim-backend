import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCustomPaymentLinkRequestDto {
  @ApiProperty({ example: 'wholesale-client@example.com' })
  @IsEmail()
  @IsNotEmpty()
  customer_email: string;

  @ApiProperty({
    example: 5000000,
    minimum: 1,
    description: 'Amount in the lowest currency unit (VND only for now)',
  })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ example: 'VND', enum: ['VND'], default: 'VND' })
  @IsOptional()
  @IsString()
  @IsIn(['VND'])
  currency?: string;

  @ApiProperty({
    example: 'Thanh toan don hang eSim Custom - 1000 Pack Asia',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;
}
