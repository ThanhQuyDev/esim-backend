import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Ticket {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String, example: 'customer@example.com' })
  customerEmail: string;

  @ApiProperty({ type: String, example: 'Cannot activate eSIM' })
  subject: string;

  @ApiProperty({ type: String, example: 'Detailed description of the issue' })
  description: string;

  @ApiPropertyOptional({ type: String, example: 'ORD-12345' })
  orderId: string | null;

  @ApiPropertyOptional({ type: String, example: 'iPhone 15 Pro' })
  deviceModel: string | null;

  @ApiPropertyOptional({ type: String, example: '8901234567890123456' })
  iccid: string | null;

  @ApiPropertyOptional({ type: String, example: 'Vietnam' })
  planDestination: string | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://s3.example.com/file1.png'],
  })
  attachments: string[] | null;

  @ApiProperty({
    type: String,
    example: 'open',
    enum: ['open', 'in_progress', 'resolved', 'closed'],
  })
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
