import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class CreateMessageDto {
  @IsNumber()
  @IsNotEmpty()
  chatRoomId: number;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsUrl()
  @IsOptional()
  fileUrl?: string;

  @IsString()
  @IsOptional()
  fileName?: string;

  @IsString()
  @IsOptional()
  fileType?: string;

  @IsNumber()
  @IsOptional()
  fileSize?: number;

  /** Id of the message being quoted; must belong to the same room (#073). */
  @IsNumber()
  @IsOptional()
  replyToId?: number;
}
