import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ChatAutomationType } from '../chat-automations.enum';

export class CreateChatAutomationDto {
  @ApiProperty({
    enum: ChatAutomationType,
    example: ChatAutomationType.WELCOME,
  })
  @IsNotEmpty()
  @IsEnum(ChatAutomationType)
  type: ChatAutomationType;

  @ApiProperty({
    type: String,
    example: 'Xin chào! Chúng tôi có thể giúp gì cho bạn?',
  })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiPropertyOptional({ type: Boolean, example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
