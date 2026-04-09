import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateProfitMarginDto {
  @ApiProperty({ example: 'Default Margin', type: String })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 30.0, type: Number })
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  percentage: number;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
