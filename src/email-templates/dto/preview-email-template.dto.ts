import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class PreviewEmailTemplateDto {
  @ApiPropertyOptional({
    description: 'Override htmlBody for preview without saving',
  })
  @IsString()
  @IsOptional()
  htmlBody?: string;

  @ApiPropertyOptional({
    description: 'Override subject for preview without saving',
  })
  @IsString()
  @IsOptional()
  subject?: string;
}

export class PreviewEmailTemplateResponseDto {
  @ApiProperty({ type: String })
  subject: string;

  @ApiProperty({ type: String })
  html: string;
}
