import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({ type: Number, example: 2 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({
    type: Number,
    example: 7,
    description: 'Number of days for multidate plans',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  periodNum?: number;
}
