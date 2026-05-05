import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateProfitMarginTierDto } from './create-profit-margin-tier.dto';
import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateProfitMarginTierDto extends PartialType(
  CreateProfitMarginTierDto,
) {
  @ApiPropertyOptional({
    example: 0,
    type: Number,
    description: 'Min VND price (inclusive)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minVnd?: number;

  @ApiPropertyOptional({
    example: 100000,
    type: Number,
    description: 'Max VND price (inclusive)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxVnd?: number;

  @ApiPropertyOptional({ example: 30.0, type: Number })
  @IsOptional()
  @IsNumber()
  percentage?: number;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
