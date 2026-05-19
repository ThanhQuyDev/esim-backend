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
}
