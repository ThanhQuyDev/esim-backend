import { ApiProperty } from '@nestjs/swagger';

export class ChatMessage {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: Number })
  chatRoomId: number;

  @ApiProperty({ type: Number })
  senderId: number;

  @ApiProperty({ type: String })
  message: string;

  @ApiProperty({ type: Boolean })
  isRead: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
