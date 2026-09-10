import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Provider identifier used in the unified topup format.
 * Matches the Vietnamese spec values.
 */
export enum TopupProvider {
  AIRALO = 'AIRALO',
  ESIM_ACCESS = 'ESIM_ACCESS',
  GADGET_KOREA = 'GADGET_KOREA',
  BILLION = 'BILLION',
  MICRO_ESIM = 'MICRO_ESIM',
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
      'Stable identifier for this package; pass this back at checkout time. ' +
      'For providers whose catalogue lives in our own `plan` table ' +
      '(GADGET_KOREA / BILLION / MICRO_ESIM) this is the `plan.id`, because a ' +
      "provider's own plan id is not guaranteed unique across our rows.",
  })
  packageId!: string;

  @ApiPropertyOptional({
    type: String,
    example: 'SKU-3GB-30D',
    description:
      'The id this package is known by on the provider side. Only differs ' +
      'from `packageId` for DB-catalogued providers. Informational — checkout ' +
      'resolves it server-side and never trusts it from the client.',
  })
  providerPackageId?: string;

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
