import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { Plan } from '../domain/plan';

export class FilterPlanDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isCheapest?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Filter by local-inventory flag (domestic eSIM plans)',
  })
  @IsOptional()
  @IsBoolean()
  isLocalInventory?: boolean;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  destinationId?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  regionId?: number;

  @ApiPropertyOptional({
    type: String,
    description:
      'Filter by country/region: matches plan country code, destination country code/name/keySearch or region name/slug',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'true: only plans with call or SMS quota; false: only plans without both',
  })
  @IsOptional()
  @IsBoolean()
  hasCallSms?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsString({ each: true })
  provider?: string[];

  @ApiPropertyOptional({
    type: Number,
    description: 'Filter by duration in days',
  })
  @IsOptional()
  @IsNumber()
  duration?: number;

  @ApiPropertyOptional({
    type: String,
    description:
      'Filter by plan type (fixed, unlimited, daily, etc.) — single value, comma-separated, or array',
  })
  @IsOptional()
  type?: string | string[];

  @ApiPropertyOptional({
    type: String,
    description: 'Filter by data amount (e.g. 1GB, 50GB)',
  })
  @IsOptional()
  @IsString()
  data?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Filter by tags (popular, best seller, new, hot deal)',
  })
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}

export class SortPlanDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  orderBy: keyof Plan;

  @ApiProperty()
  @IsString()
  order: string;
}

export class QueryPlanDto {
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
  @Transform(({ value }) => {
    if (!value) return undefined;
    return plainToInstance(FilterPlanDto, JSON.parse(value));
  })
  @ValidateNested()
  @Type(() => FilterPlanDto)
  filters?: FilterPlanDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) => {
    return value ? plainToInstance(SortPlanDto, JSON.parse(value)) : undefined;
  })
  @ValidateNested({ each: true })
  @Type(() => SortPlanDto)
  sort?: SortPlanDto[] | null;
}
