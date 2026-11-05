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

  /** Also match the slugs. The CMS only: every slug starts with "esim-". */
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  searchSlug?: boolean;

  /** Only the regions ticked "Làm khu vực cha" (vande-0411 #073). */
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isParent?: boolean;

  /** Any of: parent, child, standalone. */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  regionTypes?: string[];

  /** The packs under these parents. */
  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  parentIds?: number[];

  /**
   * What the home page and the search popup feature: a featured region with no
   * parent, plus the packs of a featured parent so its card can say how many
   * options it has and the lowest price. A featured pack belongs on its parent's
   * page instead (vande-0411 #073).
   */
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  featuredTop?: boolean;

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
