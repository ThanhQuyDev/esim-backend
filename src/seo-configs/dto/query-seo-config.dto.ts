import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
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

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Substring of the meta title (#048). Separate from {@link search}, which
   * matches the URL only: searching "destination" there used to return
   * "/en/home" because its copy happened to contain the word.
   */
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  metaTitle?: string;

  /** Substring of the meta description (#048). */
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  metaDescription?: string;

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

  /**
   * Which kind of page the config is for, derived from which entity was picked
   * when it was created: a destination, a region, a plan, or none of them
   * ("other" — the manually typed URLs like `/`, `/blog`, `/coupon`).
   *
   * The admin list mixes all of them, which is what made it unreadable (#046).
   */
  @ApiPropertyOptional({
    type: String,
    enum: ['destination', 'region', 'plan', 'other'],
  })
  @IsOptional()
  @IsIn(['destination', 'region', 'plan', 'other'])
  pageType?: 'destination' | 'region' | 'plan' | 'other';

  /** Created on or after this day, Vietnam time (vande #041). */
  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  /** Created on or before this day, the whole day counted (vande #041). */
  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  createdTo?: string;
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
    value ? plainToInstance(FilterSeoConfigDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested()
  @Type(() => FilterSeoConfigDto)
  filters?: FilterSeoConfigDto;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) => {
    return value
      ? plainToInstance(SortSeoConfigDto, JSON.parse(value))
      : undefined;
  })
  @ValidateNested({ each: true })
  @Type(() => SortSeoConfigDto)
  sort?: SortSeoConfigDto[];
}
