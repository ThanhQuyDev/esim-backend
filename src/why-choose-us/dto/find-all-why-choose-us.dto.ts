import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';

export class FilterWhyChooseUsDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: String, description: 'Filter by type' })
  @IsOptional()
  @IsString()
  type?: string;

  /** Trạng thái hoạt động, for the CMS list filter (#054). */
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === 'true' || value === true,
  )
  @IsBoolean()
  isActive?: boolean;
}

export class SortWhyChooseUsDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  orderBy: string;

  @ApiProperty()
  @IsString()
  order: string;
}

export class QueryWhyChooseUsDto {
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

  @ApiPropertyOptional({
    type: String,
    description: 'Search by title or description',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    type: String,
    description:
      'Filter by page type; several comma-separated types match rows of any of them (e.g. "trang_chu,quoc_gia")',
  })
  @IsOptional()
  @IsString()
  type?: string;

  /** Trạng thái hoạt động (#054). */
  @ApiPropertyOptional({ type: Boolean, description: 'Filter by active flag' })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === 'true' || value === true,
  )
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) =>
    value
      ? plainToInstance(FilterWhyChooseUsDto, JSON.parse(value))
      : undefined,
  )
  @ValidateNested()
  @Type(() => FilterWhyChooseUsDto)
  filters?: FilterWhyChooseUsDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) =>
    value ? plainToInstance(SortWhyChooseUsDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested({ each: true })
  @Type(() => SortWhyChooseUsDto)
  sort?: SortWhyChooseUsDto[] | null;
}
