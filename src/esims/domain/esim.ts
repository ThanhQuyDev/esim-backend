import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from '../../users/domain/user';
import { Plan } from '../../plans/domain/plan';

const idType = Number;

/** One topup applied to an eSIM, from the snapshot its order stored (#026). */
export class EsimTopupDto {
  @ApiProperty({ type: Number })
  orderId: number;

  @ApiProperty({ type: String, example: 'TOPUP-1759190000000-AB12CD' })
  orderNumber: string;

  @ApiPropertyOptional({ type: String, example: 'Vietnam-3days-3gb-topup' })
  packageId: string | null;

  @ApiPropertyOptional({ type: String, example: '3 GB - 3 Days' })
  packageName: string | null;

  @ApiPropertyOptional({ type: String, example: '3 GB' })
  dataText: string | null;

  @ApiPropertyOptional({ type: Number, example: 3 })
  durationDays: number | null;

  @ApiProperty({ type: Boolean })
  isUnlimited: boolean;

  @ApiProperty({ type: Number, example: 179000, description: 'Giá bán (VNĐ)' })
  vndPrice: number;

  @ApiProperty({ type: Number, example: 120000, description: 'Giá vốn (VNĐ)' })
  vndCostPrice: number;

  @ApiPropertyOptional({ type: String, example: 'AIRALO' })
  provider: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class Esim {
  @ApiProperty({ type: idType })
  id: number;

  @ApiPropertyOptional({ type: idType })
  orderItemId: number | null;

  @ApiPropertyOptional({ type: idType })
  userId: number | null;

  @ApiPropertyOptional({ type: idType })
  planId: number | null;

  @ApiProperty({ type: String, example: '8901234567890123456' })
  iccid: string;

  @ApiPropertyOptional({ type: String })
  smdpAddress: string | null;

  @ApiPropertyOptional({ type: String })
  activationCode: string | null;

  @ApiPropertyOptional({ type: String })
  lpa: string | null;

  @ApiPropertyOptional({ type: String })
  matchId: string | null;

  @ApiPropertyOptional({ type: String })
  qrcode: string | null;

  @ApiPropertyOptional({ type: String })
  qrAccessToken: string | null;

  @ApiPropertyOptional({ type: String })
  directAppleInstallationUrl: string | null;

  @ApiPropertyOptional({ type: String })
  apnValue: string | null;

  @ApiPropertyOptional({ type: Boolean })
  isRoaming: boolean | null;

  @ApiProperty({ type: String, example: 'available' })
  status: string;

  @ApiPropertyOptional({ type: String, example: '500MB' })
  dataUsed: string | null;

  @ApiPropertyOptional({ type: String, example: '1GB' })
  dataTotal: string | null;

  @ApiPropertyOptional()
  expiresAt: Date | null;

  @ApiPropertyOptional()
  activatedAt: Date | null;

  @ApiPropertyOptional({ type: String })
  esimTranNo: string | null;

  @ApiPropertyOptional({ type: String })
  provider: string | null;

  @ApiPropertyOptional({ type: String })
  phoneNumber: string | null;

  @ApiPropertyOptional({ type: () => User })
  user?: User | null;

  @ApiPropertyOptional({ type: () => Plan })
  plan?: Plan | null;

  /**
   * Paid topups against this ICCID (#025). Derived from the orders at read time,
   * not stored — so it is right for eSIMs topped up before this existed.
   */
  @ApiPropertyOptional({ type: Number, example: 2 })
  topupCount?: number;

  @ApiPropertyOptional()
  lastTopupAt?: Date | null;

  /**
   * Names of the topup packages applied, newest first, comma-separated (#031).
   * Enough for the customer's profile to say WHAT was topped up; the CMS detail
   * uses {@link topups} for the full breakdown.
   */
  @ApiPropertyOptional({ type: String, example: 'Vietnam-3days-3gb-topup' })
  topupPackageNames?: string | null;

  /**
   * The topup packages applied to this eSIM, newest first (#026). Only the detail
   * endpoint fills this; the list carries {@link topupCount} alone.
   */
  @ApiPropertyOptional({ type: () => [EsimTopupDto] })
  topups?: EsimTopupDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;
}
