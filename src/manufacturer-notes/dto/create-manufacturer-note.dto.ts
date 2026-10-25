import {
  IsBoolean,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const MANUFACTURER_NOTE_LANGUAGES = ['vi', 'en'] as const;

export class CreateManufacturerNoteDto {
  @ApiProperty({
    required: true,
    type: () => String,
    example: 'iPhone',
    description: 'Brand name, exactly as it appears on the device rows',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  manufacturer: string;

  @ApiProperty({
    required: true,
    enum: MANUFACTURER_NOTE_LANGUAGES,
    example: 'vi',
  })
  @IsString()
  @IsIn(MANUFACTURER_NOTE_LANGUAGES as unknown as string[])
  language: string;

  @ApiProperty({ required: true, type: () => String })
  @IsString()
  @MinLength(1)
  note: string;

  @ApiPropertyOptional({ type: () => Boolean, example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Order of a brand's notes on the page, lowest first (vande #042). */
  @ApiPropertyOptional({ type: () => Number, example: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
