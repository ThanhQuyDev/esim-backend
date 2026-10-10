import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class FindAllApnSupportDto {
  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  @IsOptional()
  limit?: number;

  /** APNs picked in the select box, comma-separated (#044, test round 4). */
  @ApiPropertyOptional({ type: String, example: 'cmhk,drei.at' })
  @IsOptional()
  @IsString()
  apns?: string;

  /**
   * Platforms that must be supported, comma-separated: tiktokIos,
   * tiktokAndroid, tiktok, chatGpt, gemini, claude (#044).
   */
  @ApiPropertyOptional({ type: String, example: 'tiktokIos,chatGpt' })
  @IsOptional()
  @IsString()
  supports?: string;

  /** Only rows still awaiting their answers. */
  @ApiPropertyOptional({ type: Boolean })
  @Transform(({ value }) =>
    value === undefined || value === ''
      ? undefined
      : value === true || value === 'true',
  )
  @IsOptional()
  needsReview?: boolean;
}
