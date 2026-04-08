import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const idType = Number;

export class Esim {
  @ApiProperty({ type: idType })
  id: number;

  @ApiPropertyOptional({ type: idType })
  orderItemId: number | null;

  @ApiPropertyOptional({ type: idType })
  userId: number | null;

  @ApiProperty({ type: String, example: '8901234567890123456' })
  iccid: string;

  @ApiPropertyOptional({ type: String })
  smdpAddress: string | null;

  @ApiPropertyOptional({ type: String })
  activationCode: string | null;

  @ApiProperty({ type: String, example: 'available' })
  status: string;

  @ApiPropertyOptional({ type: String, example: '500MB' })
  dataUsed: string | null;

  @ApiPropertyOptional({ type: String, example: '1GB' })
  dataTotal: string | null;

  @ApiPropertyOptional()
  expiresAt: Date | null;

  @ApiPropertyOptional()
  activatedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;
}
