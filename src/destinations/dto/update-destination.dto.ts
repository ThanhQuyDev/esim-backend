import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateDestinationDto } from './create-destination.dto';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDestinationDto extends PartialType(CreateDestinationDto) {
  @ApiPropertyOptional({ example: 'Japan', type: String })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'japan', type: String })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional({ example: 'JP', type: String })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

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
