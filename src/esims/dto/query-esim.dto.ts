import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { Esim } from '../domain/esim';

export class FilterEsimDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  userId?: number;

  @ApiPropertyOptional({ type: String, description: 'Filter by plan name' })
  @IsOptional()
  @IsString()
  planName?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Include all statuses (including refunded). Used by admin.',
  })
  @IsOptional()
  @IsBoolean()
  includeAll?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Plan type of the eSIM: fixed, daily, unlimited, unlimited-reduce (#020)',
  })
  @IsOptional()
  @IsString({ each: true })
  planType?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Supplier of the eSIM (#020)',
  })
  @IsOptional()
  @IsString({ each: true })
  provider?: string[];

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'true: only eSIMs whose plan includes call minutes or SMS; false: data-only (#020)',
  })
  @IsOptional()
  @IsBoolean()
  hasCallSms?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Whether the plan behind the eSIM can be topped up (#020)',
  })
  @IsOptional()
  @IsBoolean()
  topUp?: boolean;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    description: 'eSIMs created on or after this date, inclusive (#020)',
  })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    description: 'eSIMs created on or before this date, whole day (#020)',
  })
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    description: 'eSIMs expiring on or after this date, inclusive (#020)',
  })
  @IsOptional()
  @IsDateString()
  expiresFrom?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    description: 'eSIMs expiring on or before this date, whole day (#020)',
  })
  @IsOptional()
  @IsDateString()
  expiresTo?: string;
}

export class SortEsimDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  orderBy: keyof Esim;

  @ApiProperty()
  @IsString()
  order: string;
}

export class QueryEsimDto {
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
    description: 'Search by iccid or esimTranNo',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) =>
    value ? plainToInstance(FilterEsimDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested()
  @Type(() => FilterEsimDto)
  filters?: FilterEsimDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) =>
    value ? plainToInstance(SortEsimDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested({ each: true })
  @Type(() => SortEsimDto)
  sort?: SortEsimDto[] | null;
}
