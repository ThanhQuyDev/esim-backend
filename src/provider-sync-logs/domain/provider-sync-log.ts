import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const idType = Number;

export class ProviderSyncLog {
  @ApiProperty({ type: idType })
  id: number;

  @ApiProperty({ type: String, example: 'airalo' })
  provider: string;

  @ApiProperty({ type: String, example: 'plans' })
  syncType: string;

  @ApiProperty({ type: String, example: 'started' })
  status: string;

  @ApiPropertyOptional({ type: Number, example: 150 })
  itemsSynced: number | null;

  @ApiPropertyOptional({ type: String })
  errorMessage: string | null;

  @ApiProperty()
  startedAt: Date;

  @ApiPropertyOptional()
  completedAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}
