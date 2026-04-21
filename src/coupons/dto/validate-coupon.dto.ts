import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class ValidateCouponDto {
  @ApiProperty({ type: String, example: 'SUMMER10' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ type: Number, example: 25.5 })
  @IsNumber()
  @Min(0)
  orderAmount: number;
}

export class ValidateCouponResponseDto {
  @ApiProperty({ type: Boolean })
  valid: boolean;

  @ApiProperty({ type: Number, example: 10 })
  discountPercent: number;

  @ApiProperty({ type: Number, example: 2.55 })
  discountAmount: number;

  @ApiProperty({ type: Number, example: 22.95 })
  finalAmount: number;

  @ApiProperty({ type: String, required: false })
  message?: string;
}
