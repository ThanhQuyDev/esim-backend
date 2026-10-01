import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MENU_SLIDE_KEYS, MENU_SLIDE_LANGUAGES } from '../menu-slide-keys';

export class CreateMenuSlideDto {
  @ApiProperty({
    required: true,
    enum: MENU_SLIDE_KEYS,
    description: 'Which mega-menu panel the slide belongs to',
  })
  @IsString()
  @IsIn(MENU_SLIDE_KEYS as unknown as string[])
  menuKey: string;

  @ApiProperty({ required: true, type: () => String })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @ApiProperty({ required: true, type: () => String })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description: string;

  @ApiProperty({ required: true, type: () => String, example: '/goi-esim' })
  @IsString()
  @MinLength(1)
  href: string;

  @ApiProperty({
    required: true,
    type: () => String,
    description: 'Image URL, as returned by the files upload endpoint',
  })
  @IsString()
  @MinLength(1)
  image: string;

  @ApiPropertyOptional({
    type: () => String,
    description: 'Alt text; leave empty for a decorative image',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  imageAlt?: string | null;

  @ApiProperty({
    required: true,
    enum: MENU_SLIDE_LANGUAGES,
    example: 'vi',
  })
  @IsString()
  @IsIn(MENU_SLIDE_LANGUAGES as unknown as string[])
  language: string;

  @ApiPropertyOptional({ type: () => Number, example: 0 })
  @IsOptional()
  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? value
      : Number(value),
  )
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ type: () => Boolean, example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
