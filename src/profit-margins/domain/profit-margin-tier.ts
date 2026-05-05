import { ApiProperty } from '@nestjs/swagger';

const idType = Number;

export class ProfitMarginTier {
  @ApiProperty({ type: idType })
  id: number;

  @ApiProperty({
    type: Number,
    example: 0,
    description: 'Min VND price (inclusive)',
  })
  minVnd: number;

  @ApiProperty({
    type: Number,
    example: 100000,
    description: 'Max VND price (inclusive)',
  })
  maxVnd: number;

  @ApiProperty({
    type: Number,
    example: 30.0,
    description: 'Profit percentage for this range',
  })
  percentage: number;

  @ApiProperty({ type: Boolean, example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;
}
