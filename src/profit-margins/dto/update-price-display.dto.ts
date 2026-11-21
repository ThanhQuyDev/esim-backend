import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { AUTO_STRIKE_MAX } from '../price-display.service';

export class UpdatePriceDisplayDto {
  @ApiProperty({
    example: 50,
    description:
      'Badge percent shown on plans without a discount of their own (0 = off).',
  })
  @IsInt()
  @Min(0)
  @Max(AUTO_STRIKE_MAX)
  autoStrikePercent!: number;
}
