import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { Blog } from '../domain/blog';

export class FilterBlogDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  parent?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  authorSlug?: string;

  /**
   * Bylines of pre-profile articles that share `authorSlug` (#030). Filled in by
   * the service, never read from the request — undecorated, so the validation
   * whitelist strips it from any query that tries to send it.
   */
  legacyAuthorNames?: string[];
}

export class SortBlogDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  orderBy: keyof Blog;

  @ApiProperty()
  @IsString()
  order: string;
}

export class QueryBlogDto {
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

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) =>
    value ? plainToInstance(FilterBlogDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested()
  @Type(() => FilterBlogDto)
  filters?: FilterBlogDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) =>
    value ? plainToInstance(SortBlogDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested({ each: true })
  @Type(() => SortBlogDto)
  sort?: SortBlogDto[] | null;
}
