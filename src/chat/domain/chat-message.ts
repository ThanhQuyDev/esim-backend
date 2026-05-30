import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiProperty({ type: Boolean })
  isRead: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
