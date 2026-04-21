import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Coupon {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String, example: 'SUMMER10' })
  code: string;

  @ApiProperty({ type: Number, example: 10 })
  discountPercent: number;

  @ApiPropertyOptional({ type: Number, example: 100 })
  maxUsage: number | null;

  @ApiPropertyOptional({ type: Number, example: 1 })
  maxUsagePerUser: number | null;

  @ApiProperty({ type: Number, example: 0 })
  usageCount: number;

  @ApiPropertyOptional({ type: Number, example: 5.0 })
  minOrderAmount: number | null;

  @ApiPropertyOptional({ type: Date })
  expiresAt: Date | null;

  @ApiProperty({ type: Boolean, example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;
}
