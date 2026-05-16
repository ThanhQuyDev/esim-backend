import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateRegionDto } from './create-region.dto';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateRegionDto extends PartialType(CreateRegionDto) {
  @ApiPropertyOptional({ example: 'Asia', type: String })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'asia', type: String })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  avatarUrl?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  iconUrl?: string | null;

  @ApiPropertyOptional({
    example: 'Explore Europe with high-speed data coverage',
    type: String,
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    example: 'Khám phá Châu Âu với phủ sóng dữ liệu tốc độ cao',
    type: String,
  })
  @IsOptional()
  @IsString()
  descriptionVi?: string | null;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2, 3],
    description: 'Array of destination IDs to associate with this region',
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  destinationIds?: number[];
}
