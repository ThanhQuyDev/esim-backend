import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  MaxLength,
} from 'class-validator';

export class CreateTicketDto {
  @ApiProperty({ type: String, example: 'customer@example.com' })
  @IsEmail()
  @IsNotEmpty()
  customerEmail: string;

  @ApiProperty({ type: String, example: 'Cannot activate eSIM' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject: string;

  @ApiProperty({ type: String, example: 'Detailed description of the issue' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ type: String, example: 'ORD-12345' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  orderId?: string;

  @ApiPropertyOptional({ type: String, example: 'iPhone 15 Pro' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceModel?: string;

  @ApiPropertyOptional({ type: String, example: '8901234567890123456' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  iccid?: string;

  @ApiPropertyOptional({ type: String, example: 'Vietnam' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  planDestination?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://s3.example.com/file1.png'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  /**
   * Honeypot (#033): the form's hidden "website" field. People never see it and
   * leave it empty; a script that fills every input gives itself away.
   */
  @ApiPropertyOptional({
    type: String,
    description: 'Leave empty. A filled value marks the request as spam.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;
}
