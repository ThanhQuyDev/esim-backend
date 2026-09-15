import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';

export class FilterFooterDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  search?: string;

  /** Column heading, matched in either language (#045). */
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  category?: string;
}

export class SortFooterDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  orderBy: string;

  @ApiProperty()
  @IsString()
  order: string;
}

export class QueryFooterDto {
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

  @ApiPropertyOptional({ type: String, description: 'Search by title' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Search by column heading (English or Vietnamese)',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) =>
    value ? plainToInstance(FilterFooterDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested()
  @Type(() => FilterFooterDto)
  filters?: FilterFooterDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) =>
    value ? plainToInstance(SortFooterDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested({ each: true })
  @Type(() => SortFooterDto)
  sort?: SortFooterDto[] | null;
}
