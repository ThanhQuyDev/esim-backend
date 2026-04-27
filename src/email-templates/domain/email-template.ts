import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmailTemplate {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String, example: 'esim_purchase' })
  name: string;

  @ApiProperty({ type: String, example: 'Your eSIM is ready' })
  subject: string;

  @ApiProperty({ type: String })
  htmlBody: string;

  @ApiPropertyOptional({ type: Boolean })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
