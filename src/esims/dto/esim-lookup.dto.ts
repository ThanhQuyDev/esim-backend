import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

/** Body of the ICCID form on the public "Tra cứu eSIM" page (#003). */
export class CreateEsimLookupTokenDto {
  @ApiProperty({ type: String, example: '8901234567890123456' })
  @Transform(({ value }) =>
    // Customers copy the ICCID out of the email, so spaces and dashes arrive
    // with it.
    typeof value === 'string' ? value.replace(/[\s-]/g, '') : value,
  )
  @IsString()
  @Matches(/^[0-9]{18,22}$/, { message: 'iccidInvalid' })
  iccid: string;
}

export class EsimLookupTokenResponseDto {
  @ApiProperty({ type: String })
  token: string;
}

/**
 * What the public page may show. Deliberately narrower than `Esim`: no
 * activation code, LPA, QR token or matching id (a forwarded link must not let
 * anyone install the profile), and no provider name (that would expose which
 * partner supplies the eSIM — same rule as #029).
 */
export class EsimLookupResponseDto {
  @ApiProperty({ type: String, example: '•••••••••••••••3456' })
  iccidMasked: string | null;

  @ApiPropertyOptional({ type: String, example: 'Japan 5GB / 7 days' })
  planName: string | null;

  @ApiProperty({ type: String, example: 'sold' })
  status: string;

  @ApiProperty({ type: Boolean })
  isUnlimited: boolean;

  /** MB included in the plan. 0 when unknown. */
  @ApiProperty({ type: Number })
  totalMb: number;

  @ApiProperty({ type: Number })
  usedMb: number;

  @ApiPropertyOptional({ type: Number })
  remainingMb: number | null;

  @ApiPropertyOptional({ type: Number })
  durationDays: number | null;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  activatedAt: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  expiredAt: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  lastUpdateTime: string | null;

  /**
   * False when the provider has no usage API (Viettel and other local
   * inventory), so the page says the counters are unavailable instead of drawing
   * an empty bar.
   */
  @ApiProperty({ type: Boolean })
  usageAvailable: boolean;

  /** Minutes/SMS allowance, for eSIMs that carry one (#023). */
  @ApiPropertyOptional({ type: Number })
  callMinutes: number | null;

  @ApiPropertyOptional({ type: Number })
  smsCount: number | null;
}
