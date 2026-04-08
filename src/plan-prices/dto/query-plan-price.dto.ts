import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { PlanPrice } from '../domain/plan-price';

export class FilterPlanPriceDto {
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  planId?: number;
}

export class SortPlanPriceDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  orderBy: keyof PlanPrice;

  @ApiProperty()
  @IsString()
  order: string;
}

export class QueryPlanPriceDto {
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
      ? plainToInstance(FilterPlanPriceDto, JSON.parse(value))
      : undefined,
  )
  @ValidateNested()
  @Type(() => FilterPlanPriceDto)
  filters?: FilterPlanPriceDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) => {
    return value
      ? plainToInstance(SortPlanPriceDto, JSON.parse(value))
      : undefined;
  })
  @ValidateNested({ each: true })
  @Type(() => SortPlanPriceDto)
  sort?: SortPlanPriceDto[] | null;
}
