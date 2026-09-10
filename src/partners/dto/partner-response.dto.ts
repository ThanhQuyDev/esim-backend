import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  OrderPartnerCommissionStatusEnum,
  PartnerDepositRequestStatusEnum,
  PartnerLegalTypeEnum,
  PartnerLinkStatusEnum,
  PartnerPayoutStatusEnum,
  PartnerStatusEnum,
  PartnerTypeEnum,
  PartnerWalletStatusEnum,
} from '../partners.enum';

export class PartnerProfileDto {
  @ApiProperty({ type: Number })
  id!: number;

  @ApiProperty({ type: Number })
  userId!: number;

  @ApiProperty({ enum: PartnerTypeEnum })
  partnerType!: PartnerTypeEnum;

  @ApiProperty({ enum: PartnerLegalTypeEnum })
  legalType!: PartnerLegalTypeEnum;

  @ApiPropertyOptional({ type: String, nullable: true })
  companyName!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  taxCode!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  businessAddress!: string | null;

  @ApiProperty({ type: String })
  contactName!: string;

  @ApiProperty({ type: String })
  contactPhone!: string;

  @ApiProperty({ type: String })
  contactEmail!: string;

  @ApiPropertyOptional({ type: Object, nullable: true })
  channelInfo!: Record<string, unknown> | null;

  @ApiProperty({ enum: PartnerStatusEnum })
  status!: PartnerStatusEnum;

  @ApiPropertyOptional({ type: String, nullable: true })
  tierCode!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  rejectionReason!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PartnerWalletDto {
  @ApiProperty({ type: Number })
  partnerId!: number;

  @ApiProperty({ type: Number })
  balanceVnd!: number;

  @ApiProperty({ enum: PartnerWalletStatusEnum })
  status!: PartnerWalletStatusEnum;
}

export class PartnerWalletTransactionDto {
  @ApiProperty({ type: Number })
  id!: number;

  @ApiProperty({ type: Number })
  partnerId!: number;

  @ApiProperty({ type: String })
  type!: string;

  @ApiProperty({ type: Number })
  amountVnd!: number;

  @ApiProperty({ type: Number })
  balanceAfterVnd!: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  orderId!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  reason!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class PartnerLinkDto {
  @ApiProperty({ type: Number })
  id!: number;

  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  label!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  targetPath!: string | null;

  @ApiProperty({ enum: PartnerLinkStatusEnum })
  status!: PartnerLinkStatusEnum;

  @ApiProperty({ type: Number })
  clickCount!: number;

  @ApiProperty({ type: Number })
  conversionCount!: number;

  @ApiProperty({ type: Number })
  totalCommissionVnd!: number;

  @ApiProperty({ type: String })
  shareUrl!: string;

  @ApiProperty()
  createdAt!: Date;
}

export class PartnerCommissionDto {
  @ApiProperty({ type: Number })
  id!: number;

  @ApiProperty({ type: Number })
  orderId!: number;

  @ApiProperty({ type: Number })
  partnerId!: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  linkId!: number | null;

  @ApiProperty({ type: Number })
  commissionVnd!: number;

  @ApiProperty({ enum: OrderPartnerCommissionStatusEnum })
  status!: OrderPartnerCommissionStatusEnum;

  @ApiProperty()
  createdAt!: Date;
}

export class PartnerDepositRequestDto {
  @ApiProperty({ type: Number })
  id!: number;

  @ApiProperty({ type: Number })
  partnerId!: number;

  @ApiProperty({ type: Number })
  amountVnd!: number;

  @ApiProperty({ type: String })
  bankTransferCode!: string;

  @ApiProperty({ type: String })
  qrUrl!: string;

  @ApiProperty({ type: String })
  accountNumber!: string;

  @ApiProperty({ type: String })
  accountName!: string;

  @ApiProperty({ type: String })
  bankCode!: string;

  @ApiProperty({ enum: PartnerDepositRequestStatusEnum })
  status!: PartnerDepositRequestStatusEnum;

  @ApiProperty()
  createdAt!: Date;
}

export class PartnerPayoutDto {
  @ApiProperty({ type: Number })
  id!: number;

  @ApiProperty({ type: Number })
  partnerId!: number;

  @ApiProperty({ type: Number })
  amountVnd!: number;

  @ApiProperty({ enum: PartnerPayoutStatusEnum })
  status!: PartnerPayoutStatusEnum;

  @ApiPropertyOptional({ type: String, nullable: true })
  adminNote!: string | null;

  @ApiProperty()
  createdAt!: Date;
}
