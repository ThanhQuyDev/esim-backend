import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Ticket {
  @ApiProperty({ type: Number })
  id: number;

  /** The reference the customer sees, in every support email's subject (#059). */
  @ApiPropertyOptional({ type: String, example: 'HT-000123' })
  ticketNumber: string | null;

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

  /** When it was marked resolved — the 48-hour auto-close clock (#061). */
  @ApiPropertyOptional({ type: Date, nullable: true })
  resolvedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
