import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateDestinationDto {
  @ApiProperty({ example: 'Japan', type: String })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'japan', type: String })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  slug: string;

  @ApiProperty({ example: 'JP', type: String })
  @IsNotEmpty()
  @IsString()
  @MaxLength(10)
  countryCode: string;

  @ApiPropertyOptional({ example: 1, type: Number })
  @IsOptional()
  @IsNumber()
  parentId?: number | null;

  @ApiPropertyOptional({
    example: 'https://example.com/flags/jp.png',
    type: String,
  })
  @IsOptional()
  @IsString()
  flagUrl?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/avatars/japan.png',
    type: String,
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string | null;

  @ApiPropertyOptional({ example: 'japan nippon tokyo', type: String })
  @IsOptional()
  @IsString()
  keySearch?: string | null;

  @ApiPropertyOptional({ example: false, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 'High-speed 4G/5G coverage across Japan',
    type: String,
  })
  @IsOptional()
  @IsString()
  description?: string | null;
}
