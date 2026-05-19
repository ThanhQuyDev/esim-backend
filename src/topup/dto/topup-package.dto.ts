import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Provider identifier used in the unified topup format.
 * Matches the Vietnamese spec values.
 */
export enum TopupProvider {
  AIRALO = 'AIRALO',
  ESIM_ACCESS = 'ESIM_ACCESS',
  GADGET_KOREA = 'GADGET_KOREA',
}

/**
 * Unified topup-package format returned to Frontend regardless of source.
 * Each provider's response is mapped to this shape so the FE can render
 * a single list view.
 */
export class TopupPackageDto {
  @ApiProperty({
    enum: TopupProvider,
    example: TopupProvider.AIRALO,
  })
  provider!: TopupProvider;

  @ApiProperty({
    type: String,
    example: 'bonbon-mobile-30days-3gb-topup',
    description:
      'Provider-specific package identifier; pass this back at checkout time',
  })
  packageId!: string;

  @ApiProperty({ type: String, example: '3 GB - 100 SMS - 100 Mins - 30 Days' })
  name!: string;

  @ApiProperty({
    type: Number,
    example: 3221225472,
    description: 'Total data quota expressed in bytes',
  })
  dataAmountBytes!: number;

  @ApiProperty({ type: String, example: '3 GB' })
  dataAmountText!: string;

  @ApiProperty({ type: Number, example: 30 })
  durationDays!: number;

  @ApiProperty({ type: Boolean, example: false })
  isUnlimited!: boolean;

  @ApiProperty({
    type: Number,
    example: 10,
    description: 'Cost price (USD) — provider list price before markup',
  })
  price!: number;

  @ApiProperty({
    type: Number,
    example: 14.5,
    description: 'Retail price after FX rate / markup (USD)',
  })
  retailPrice!: number;

  @ApiPropertyOptional({
    type: Number,
    example: 360000,
    description: 'Retail price in VND (rounded). Used to charge OnePay.',
  })
  vndPrice?: number;
}
