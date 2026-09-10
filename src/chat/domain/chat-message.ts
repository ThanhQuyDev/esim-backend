import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * The slice of a quoted message the client needs to draw the quote block
 * (#073). Deliberately not the whole message: a reply chain would otherwise
 * serialise every ancestor into every socket frame.
 */
export class ChatMessageQuote {
  @ApiProperty({ type: Number })
  id: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  senderId: number | null;

  @ApiProperty({ type: String })
  message: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  fileUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  fileName?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  fileType?: string | null;
}

export class ChatMessage {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: Number })
  chatRoomId: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  senderId: number | null;

  @ApiProperty({ type: String })
  message: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  fileUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  fileName?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  fileType?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  fileSize?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  replyToId?: number | null;

  @ApiPropertyOptional({ type: () => ChatMessageQuote, nullable: true })
  replyTo?: ChatMessageQuote | null;

  @ApiProperty({ type: Boolean })
  isRead: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
