import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Destination } from '../../destinations/domain/destination';
import { Region } from '../../regions/domain/region';

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

  @ApiProperty({ type: Boolean, example: false })
  isKyc: boolean;

  @ApiProperty({
    type: Boolean,
    example: false,
    description:
      'True if esims are served from local inventory, not from provider API',
  })
  isLocalInventory: boolean;

  @ApiPropertyOptional({ type: String, example: 'internet' })
  apn: string | null;

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
