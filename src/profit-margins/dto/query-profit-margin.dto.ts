import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { ProfitMargin } from '../domain/profit-margin';

export class FilterProfitMarginDto {
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SortProfitMarginDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  orderBy: keyof ProfitMargin;

  @ApiProperty()
  @IsString()
  order: string;
}

export class QueryProfitMarginDto {
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
    value ? plainToInstance(FilterProfitMarginDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested()
  @Type(() => FilterProfitMarginDto)
  filters?: FilterProfitMarginDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) => {
    return value ? plainToInstance(SortProfitMarginDto, JSON.parse(value)) : undefined;
  })
  @ValidateNested({ each: true })
  @Type(() => SortProfitMarginDto)
  sort?: SortProfitMarginDto[] | null;
}
