import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Plan } from '../../plans/domain/plan';

const idType = Number;

export class PlanPrice {
  @ApiProperty({
    type: idType,
  })
  id: number;

  @ApiProperty({
    type: Number,
    example: 1,
  })
  planId: number;

  @ApiPropertyOptional({
    type: () => Plan,
  })
  plan?: Plan;

  @ApiProperty({
    type: String,
    example: 'USD',
  })
  currency: string;

  @ApiProperty({
    type: Number,
    example: 9.99,
  })
  price: number;

  @ApiPropertyOptional({
    type: Number,
    example: 14.99,
  })
  originalPrice: number | null;

  @ApiProperty({
    type: Boolean,
    example: true,
  })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;
}
