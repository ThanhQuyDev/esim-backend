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

  @ApiProperty({ type: Number, example: 3.0 })
  dataGb: number;

  @ApiProperty({ type: Number, example: 1.1 })
  costPrice: number;

  @ApiProperty({ type: Number, example: 1.43 })
  price: number;

  @ApiProperty({ type: Number, example: 4.5 })
  retailPrice: number;

  @ApiProperty({ type: String, example: 'USD' })
  currency: string;

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
    example: 10,
    description: 'Discount percentage',
  })
  discount: number;

  @ApiProperty({ type: Number, example: 45000, description: 'Price in VND' })
  vndPrice: number;

  @ApiProperty({ type: Boolean, example: false })
  isKyc: boolean;

  @ApiPropertyOptional({ type: String, example: 'internet' })
  apn: string | null;

  @ApiPropertyOptional()
  lastSyncedAt: Date | null;

  @ApiProperty({ type: Boolean, example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;
}
