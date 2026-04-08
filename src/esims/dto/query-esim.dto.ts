import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { Esim } from '../domain/esim';

export class FilterEsimDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  userId?: number;
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
