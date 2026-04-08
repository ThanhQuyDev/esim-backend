import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateProviderSyncLogDto } from './create-provider-sync-log.dto';
import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateProviderSyncLogDto extends PartialType(CreateProviderSyncLogDto) {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  itemsSynced?: number | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  errorMessage?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  completedAt?: Date | null;
}
