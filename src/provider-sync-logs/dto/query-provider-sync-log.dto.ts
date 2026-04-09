import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { ProviderSyncLog } from '../domain/provider-sync-log';

export class FilterProviderSyncLogDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  syncType?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  status?: string;
}

export class SortProviderSyncLogDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  orderBy: keyof ProviderSyncLog;

  @ApiProperty()
  @IsString()
  order: string;
}

export class QueryProviderSyncLogDto {
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
      ? plainToInstance(FilterProviderSyncLogDto, JSON.parse(value))
      : undefined,
  )
  @ValidateNested()
  @Type(() => FilterProviderSyncLogDto)
  filters?: FilterProviderSyncLogDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) =>
    value
      ? plainToInstance(SortProviderSyncLogDto, JSON.parse(value))
      : undefined,
  )
  @ValidateNested({ each: true })
  @Type(() => SortProviderSyncLogDto)
  sort?: SortProviderSyncLogDto[] | null;
}
