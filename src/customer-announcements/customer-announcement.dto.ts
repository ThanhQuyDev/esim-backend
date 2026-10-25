import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_PERIODS,
  type AnnouncementAudience,
  type AnnouncementPeriod,
} from './announcement-window';

/** Who an announcement goes to (vande #072). */
export class AnnouncementAudienceDto {
  @ApiProperty({ enum: ANNOUNCEMENT_AUDIENCES, example: 'purchased' })
  @IsIn(ANNOUNCEMENT_AUDIENCES)
  audience!: AnnouncementAudience;

  @ApiProperty({ enum: ANNOUNCEMENT_PERIODS, example: 'last_30_days' })
  @IsIn(ANNOUNCEMENT_PERIODS)
  period!: AnnouncementPeriod;
}

/** "Soạn thông báo gửi khách hàng" (vande #072). */
export class CreateCustomerAnnouncementDto extends AnnouncementAudienceDto {
  @ApiProperty({ example: 'Ưu đãi eSIM tháng 11' })
  @IsString()
  @MinLength(3, { message: 'Tiêu đề cần ít nhất 3 ký tự.' })
  @MaxLength(200)
  subject!: string;

  @ApiProperty({ example: '<p>Chào bạn…</p>' })
  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập nội dung.' })
  @MaxLength(100_000)
  body!: string;

  /** Seconds between two emails, so a mailbox is not flooded. */
  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3600)
  intervalSec!: number;

  /** When to start; omitted means now. */
  @ApiPropertyOptional({ example: '2026-11-01T09:00:00+07:00' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

/** What the CMS preview renders (vande #072). */
export class PreviewCustomerAnnouncementDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  subject!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100_000)
  body!: string;
}
