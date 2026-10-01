import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Every field is optional and nullable: an empty field means "use the built-in
 * default", which is what lets an admin clear a cover image without having to
 * supply a replacement.
 */
export class UpdateAuthPageSettingDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  logoText?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImageUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  quote?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  quoteAuthor?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  heading?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subheading?: string | null;
}

export class AuthPageSettingDto {
  @ApiProperty({ example: 'admin', enum: ['admin', 'partner'] })
  mode: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  logoUrl: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  logoText: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  coverImageUrl: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  quote: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  quoteAuthor: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  heading: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  subheading: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  updatedAt: string | null;
}
