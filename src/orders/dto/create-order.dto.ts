import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ example: 1, type: Number })
  @IsNotEmpty()
  @IsNumber()
  userId: number;

  @ApiProperty({ example: 'ORD-20260403-001', type: String })
  @IsNotEmpty()
  @IsString()
  orderNumber: string;

  @ApiPropertyOptional({ example: 'pending', type: String })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ example: 99.99, type: Number })
  @IsNotEmpty()
  @IsNumber()
  totalAmount: number;

  @ApiProperty({ example: 'USD', type: String })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency: string;

  @ApiPropertyOptional({ example: 'credit_card', type: String })
  @IsOptional()
  @IsString()
  paymentMethod?: string | null;

  @ApiPropertyOptional({ example: 'pi_3abc123', type: String })
  @IsOptional()
  @IsString()
  paymentId?: string | null;
}
