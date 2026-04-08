import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateProviderSyncLogDto {
  @ApiProperty({ example: 'airalo', type: String })
  @IsNotEmpty()
  @IsString()
  provider: string;

  @ApiProperty({ example: 'plans', type: String })
  @IsNotEmpty()
  @IsString()
  syncType: string;

  @ApiPropertyOptional({ example: 'started', type: String })
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

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  startedAt: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  completedAt?: Date | null;
}
