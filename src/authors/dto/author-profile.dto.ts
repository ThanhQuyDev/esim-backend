import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Longest author summary the CMS accepts, in either language (#025). */
export const AUTHOR_DESCRIPTION_MAX_LENGTH = 600;

export class AuthorProfileDto {
  @ApiProperty({ type: String })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  /** English name; the Vietnamese one is shown when this is empty (#025). */
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nameEn?: string | null;

  @ApiProperty({ type: String })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  slug: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  avatar?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(AUTHOR_DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  /** English summary; the Vietnamese one is shown when this is empty (#025). */
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(AUTHOR_DESCRIPTION_MAX_LENGTH)
  descriptionEn?: string | null;
}
