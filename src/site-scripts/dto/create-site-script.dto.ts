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
import { SITE_SCRIPT_PLACEMENTS } from '../site-script-placements';

export class CreateSiteScriptDto {
  @ApiProperty({
    required: true,
    type: () => String,
    example: 'Google Analytics 4',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    required: true,
    type: () => String,
    description: 'Paste the vendor snippet unchanged',
  })
  @IsString()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({ enum: SITE_SCRIPT_PLACEMENTS, example: 'head' })
  @IsOptional()
  @IsString()
  @IsIn(SITE_SCRIPT_PLACEMENTS as unknown as string[])
  placement?: string;

  @ApiPropertyOptional({ type: () => Boolean, example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

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
}
