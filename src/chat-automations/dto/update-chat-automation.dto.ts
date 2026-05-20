import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateChatAutomationDto {
  @ApiPropertyOptional({
    type: String,
    example: 'Cảm ơn bạn, tư vấn viên sẽ hỗ trợ bạn ngay trong giây lát!',
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ type: Boolean, example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
