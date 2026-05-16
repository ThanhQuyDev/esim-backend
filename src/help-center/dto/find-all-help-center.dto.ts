import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { HelpCenterCategory, HelpCenterParent } from '../domain/help-center';

export class FilterHelpCenterDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: HelpCenterCategory })
  @IsOptional()
  @IsEnum(HelpCenterCategory)
  category?: HelpCenterCategory;

  @ApiPropertyOptional({ enum: HelpCenterParent })
  @IsOptional()
  @IsEnum(HelpCenterParent)
  parent?: HelpCenterParent;
}

export class SortHelpCenterDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  orderBy: string;

  @ApiProperty()
  @IsString()
  order: string;
}

export class QueryHelpCenterDto {
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
    value ? plainToInstance(FilterHelpCenterDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested()
  @Type(() => FilterHelpCenterDto)
  filters?: FilterHelpCenterDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) =>
    value ? plainToInstance(SortHelpCenterDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested({ each: true })
  @Type(() => SortHelpCenterDto)
  sort?: SortHelpCenterDto[] | null;
}
