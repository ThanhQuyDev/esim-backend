import {
  IsBoolean,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { DeviceType } from '../../supported-devices/domain/supported-device';
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
  @ValidateIf((o: CreateManufacturerNoteDto) => !o.deviceType)
  @MinLength(1)
  @MaxLength(255)
  manufacturer: string;

  /**
   * A note for a whole category instead of one brand (vande-2011 #031):
   * `manufacturer` may then be empty.
   */
  @ApiPropertyOptional({ enum: DeviceType, nullable: true })
  @IsOptional()
  @IsIn([...Object.values(DeviceType), null])
  deviceType?: string | null;

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
