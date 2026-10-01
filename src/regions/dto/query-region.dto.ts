import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { Region } from '../domain/region';

export class FilterRegionDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  /**
   * Suppliers to match against the free-text `providers` column (#036), exactly
   * as the destination filter does: the column is typed by hand, so each entry
   * is a case-insensitive substring and a region qualifies if it mentions ANY
   * of them.
   */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  providers?: string[];
}

export class SortRegionDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  orderBy: keyof Region;

  @ApiProperty()
  @IsString()
  order: string;
}

export class QueryRegionDto {
  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) =>
    value ? plainToInstance(FilterRegionDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested()
  @Type(() => FilterRegionDto)
  filters?: FilterRegionDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) => {
    return value
      ? plainToInstance(SortRegionDto, JSON.parse(value))
      : undefined;
  })
  @ValidateNested({ each: true })
  @Type(() => SortRegionDto)
  sort?: SortRegionDto[] | null;
}
