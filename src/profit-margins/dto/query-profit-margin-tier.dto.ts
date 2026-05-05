import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { ProfitMarginTier } from '../domain/profit-margin-tier';

export class FilterProfitMarginTierDto {
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SortProfitMarginTierDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  orderBy: keyof ProfitMarginTier;

  @ApiProperty()
  @IsString()
  order: string;
}

export class QueryProfitMarginTierDto {
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
    value
      ? plainToInstance(FilterProfitMarginTierDto, JSON.parse(value))
      : undefined,
  )
  @ValidateNested()
  @Type(() => FilterProfitMarginTierDto)
  filters?: FilterProfitMarginTierDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) => {
    return value
      ? plainToInstance(SortProfitMarginTierDto, JSON.parse(value))
      : undefined;
  })
  @ValidateNested({ each: true })
  @Type(() => SortProfitMarginTierDto)
  sort?: SortProfitMarginTierDto[] | null;
}
