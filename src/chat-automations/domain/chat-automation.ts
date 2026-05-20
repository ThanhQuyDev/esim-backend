import { ApiProperty } from '@nestjs/swagger';

export class ChatAutomation {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String, example: 'WELCOME' })
  type: string;

  @ApiProperty({
    type: String,
    example: 'Xin chào! Chúng tôi có thể giúp gì cho bạn?',
  })
  message: string;

  @ApiProperty({ type: Boolean, example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
