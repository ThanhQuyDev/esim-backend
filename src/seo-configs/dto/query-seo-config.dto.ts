import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class FilterSeoConfigDto {
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  destinationId?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  regionId?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  planId?: number;
}

export class SortSeoConfigDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  orderBy?: string;

  @ApiPropertyOptional({ type: String, enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsString()
  order?: 'ASC' | 'DESC';
}

export class QuerySeoConfigDto {
  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ type: Number, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({ type: () => FilterSeoConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FilterSeoConfigDto)
  filters?: FilterSeoConfigDto;

  @ApiPropertyOptional({ type: () => [SortSeoConfigDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SortSeoConfigDto)
  sort?: SortSeoConfigDto[];
}
