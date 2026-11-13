import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({ type: Number, example: 2 })
  @IsInt()
  @Min(1)
  @Max(100)
  quantity: number;

  @ApiPropertyOptional({
    type: Number,
    example: 7,
    description: 'Number of days for multidate plans',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  periodNum?: number;
}
