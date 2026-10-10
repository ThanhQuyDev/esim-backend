import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Destination } from '../../destinations/domain/destination';
import { Region } from '../../regions/domain/region';
import { DailyResetPolicyEnum } from '../plan-daily-reset';

const idType = Number;

export class Plan {
  @ApiProperty({ type: idType })
  id: number;

  @ApiProperty({ type: String, example: 'esimaccess' })
  provider: string;

  @ApiProperty({ type: String, example: 'CKH002' })
  providerPlanId: string;

  @ApiProperty({ type: String, example: 'Spain 3GB 30Days' })
  name: string;

  @ApiProperty({ type: String, example: 'esimaccess-CKH002' })
  slug: string;

  @ApiPropertyOptional({ type: String, example: 'ES' })
  countryCode: string | null;

  @ApiPropertyOptional({ type: Number, example: 1 })
  destinationId: number | null;

  @ApiPropertyOptional({ type: () => Destination })
  destination?: Destination;

  @ApiPropertyOptional({ type: Number, example: 1 })
  regionId: number | null;

  @ApiPropertyOptional({ type: () => Region })
  region?: Region;

  @ApiProperty({ type: Number, example: 30 })
  durationDays: number;

  @ApiProperty({ type: Number, example: 3072 })
  dataMb: number;

  @ApiProperty({ type: Number, example: 1.1 })
  costPrice: number;

  @ApiProperty({ type: Number, example: 1.43 })
  price: number;

  @ApiProperty({ type: Number, example: 4.5 })
  retailPrice: number;

  @ApiProperty({ type: String, example: 'USD' })
  currency: string;

  @ApiPropertyOptional({ type: Number, example: 100 })
  sms: number | null;

  @ApiPropertyOptional({ type: Number, example: 50 })
  call: number | null;

  @ApiProperty({ type: String, example: 'data-in-total' })
  type: string;

  @ApiProperty({ type: Boolean, example: true })
  topUp: boolean;

  @ApiPropertyOptional({ type: String, example: '4G,5G' })
  speed: string | null;

  @ApiPropertyOptional({ type: String, example: 'Viettel,Mobifone' })
  operatorName: string | null;

  @ApiPropertyOptional({ type: String, example: '1 Mbps' })
  fupSpeed: string | null;

  @ApiProperty({ type: Boolean, example: false })
  isAbleMultidate: boolean;

  @ApiProperty({ type: Boolean, example: false })
  isCheapest: boolean;

  @ApiProperty({
    type: Number,
    example: 128,
    description:
      'Units sold (completed items of paid orders), recounted hourly (#053).',
  })
  /** Written by the recount job only, so new plans leave it to the DB default. */
  soldCount?: number;

  @ApiProperty({
    type: Number,
    example: 10,
    description: 'Discount percentage',
  })
  discount: number;

  @ApiProperty({ type: Number, example: 45000, description: 'Price in VND' })
  vndPrice: number;

  @ApiProperty({
    type: Number,
    example: 1.9,
    description:
      'Price in USD for every provider. Unlike price, this is never VND.',
  })
  usdPrice: number;

  @ApiProperty({
    type: Number,
    example: 1.1,
    description: 'Cost price in USD for every provider (#009).',
  })
  usdCostPrice: number;

  @ApiProperty({
    type: Number,
    example: 4.5,
    description: 'Retail price in USD for every provider (#009).',
  })
  usdRetailPrice: number;

  @ApiProperty({
    type: Number,
    example: 28000,
    description: 'Cost price in VND',
  })
  vndCostPrice: number;

  @ApiProperty({
    type: Number,
    example: 115000,
    description: 'Retail price in VND',
  })
  vndRetailPrice: number;

  @ApiPropertyOptional({
    type: Number,
    example: 12,
    description:
      'Unsold eSIMs left in stock. Only set for local-inventory plans; undefined for API providers, which mint an eSIM on demand.',
  })
  availableStock?: number | null;

  @ApiProperty({
    type: Boolean,
    example: false,
    description:
      'Exit IP is local, not routed via Hong Kong — needed for TikTok/ChatGPT.',
  })
  isNonHkIp: boolean;

  /** Exit IP location reported by the supplier, e.g. "SG", "HK" (#043). */
  @ApiPropertyOptional({ type: String, example: 'SG', nullable: true })
  ipExport?: string | null;

  @ApiProperty({ type: Boolean, example: false })
  isKyc: boolean;

  @ApiProperty({
    type: Boolean,
    example: false,
    description:
      'True if esims are served from local inventory, not from provider API',
  })
  isLocalInventory: boolean;

  @ApiProperty({
    type: Boolean,
    example: false,
    description:
      'True for eSIM nội địa (domestic-use plans shown in their own tab). Travel eSIMs sold by a Vietnamese carrier stay false.',
  })
  isDomesticEsim: boolean;

  @ApiPropertyOptional({ type: String, example: 'internet' })
  apn: string | null;

  @ApiPropertyOptional({
    type: Number,
    example: 180,
    description:
      'Days the customer has to activate the eSIM, as the supplier states it (#070). Null when not stated.',
  })
  activationValidityDays: number | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: false,
    properties: {
      tiktokIos: { type: 'boolean' },
      tiktokAndroid: { type: 'boolean' },
      tiktokAllDevices: { type: 'boolean' },
      chatGpt: { type: 'boolean' },
      known: { type: 'boolean' },
    },
    description:
      'Computed, not stored: whether TikTok and ChatGPT work on this plan, from the uploaded APN table or the esimaccess "nonhkip" marker (#065, #067). Absent on responses that do not compute it.',
  })
  appSupport?: {
    tiktokIos: boolean;
    tiktokAndroid: boolean;
    /** TikTok on BOTH platforms — the only claim that holds for an unknown device. */
    tiktokAllDevices: boolean;
    chatGpt: boolean;
    /** Whether the APN table had an answer at all — all-false otherwise means 'unknown'. */
    known: boolean;
  } | null;

  @ApiPropertyOptional({
    type: String,
    example: '2026-03-30',
    description:
      'Computed, not stored: the date the eSIM must be activated by, as yyyy-mm-dd in Vietnam time. Counted from this response for API suppliers, or taken from the printed expiry of local stock (#070). Absent when the supplier has not stated a window.',
  })
  activationDeadline?: string | null;

  @ApiPropertyOptional({
    enum: DailyResetPolicyEnum,
    example: DailyResetPolicyEnum.Rolling24h,
    description:
      'When the daily allowance starts over ("Giờ làm mới mỗi ngày"). Null where the supplier has not stated it.',
  })
  dailyResetPolicy: DailyResetPolicyEnum | null;

  @ApiPropertyOptional({
    type: Number,
    example: 8,
    description:
      'Hours east of UTC the calendar-day reset is counted in. Only meaningful for a calendar-day policy.',
  })
  dailyResetUtcOffset: number | null;

  @ApiProperty({
    type: Boolean,
    example: true,
    description: 'Hotspot supported',
  })
  hotSpot: boolean;

  @ApiPropertyOptional({
    type: String,
    example: '5GB',
    description: 'Hotspot data allowance (e.g. "5GB", "2GB")',
  })
  hotSpotAllow: string | null;

  @ApiPropertyOptional()
  lastSyncedAt: Date | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['popular', 'best seller'],
    description: 'Tags: popular, best seller, new, hot deal',
  })
  tags: string[] | null;

  @ApiProperty({ type: Boolean, example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;
}
