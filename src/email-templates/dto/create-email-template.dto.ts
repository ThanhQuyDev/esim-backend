import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateEmailTemplateDto {
  @ApiProperty({ example: 'esim_purchase' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Your eSIM is ready' })
  @IsString()
  subject: string;

  @ApiProperty({ example: '<html>...</html>' })
  @IsString()
  htmlBody: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
