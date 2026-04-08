import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateProfitMarginDto } from './create-profit-margin.dto';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateProfitMarginDto extends PartialType(CreateProfitMarginDto) {
  @ApiPropertyOptional({ example: 'Default Margin', type: String })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 30.0, type: Number })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  percentage?: number;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
