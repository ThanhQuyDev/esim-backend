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
    enum: ['open', 'in_progress', 'need_info', 'resolved', 'closed'],
  })
  status: string;

  /** When it was marked resolved — the 48-hour auto-close clock (#061). */
  @ApiPropertyOptional({ type: Date, nullable: true })
  resolvedAt: Date | null;

  /**
   * The latest message in the conversation and who wrote it (#041, test round
   * 4) — the opening form counts as the customer's. A ticket whose last word is
   * the customer's is waiting on support.
   */
  @ApiPropertyOptional({ type: Date, nullable: true })
  lastReplyAt?: Date | null;

  /** Opened by a partner (#042, test round 4). */
  @ApiPropertyOptional({ type: Boolean })
  fromPartner?: boolean;

  @ApiPropertyOptional({
    type: String,
    enum: ['customer', 'admin'],
    nullable: true,
  })
  lastReplyRole?: 'customer' | 'admin' | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  lastReplyName?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
