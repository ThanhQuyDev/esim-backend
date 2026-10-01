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
import { Destination } from '../domain/destination';

export class FilterDestinationDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsNumber()
  parentId?: number | null;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * Suppliers to match against the free-text `providers` column (#034).
   *
   * That column is typed by hand, so there is no guarantee whether it holds the
   * slug (`airalo`) or the display name (`Airalo`) — the repository matches each
   * entry as a case-insensitive substring and a destination qualifies if it
   * mentions ANY of them.
   */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  providers?: string[];
}

export class SortDestinationDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  orderBy: keyof Destination;

  @ApiProperty()
  @IsString()
  order: string;
}

export class QueryDestinationDto {
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
      ? plainToInstance(FilterDestinationDto, JSON.parse(value))
      : undefined,
  )
  @ValidateNested()
  @Type(() => FilterDestinationDto)
  filters?: FilterDestinationDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) => {
    return value
      ? plainToInstance(SortDestinationDto, JSON.parse(value))
      : undefined;
  })
  @ValidateNested({ each: true })
  @Type(() => SortDestinationDto)
  sort?: SortDestinationDto[] | null;
}
