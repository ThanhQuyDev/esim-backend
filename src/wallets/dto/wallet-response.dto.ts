import { ApiProperty } from '@nestjs/swagger';
import { WalletStatusEnum, WalletTransactionTypeEnum } from '../wallets.enum';

export class WalletTransactionDto {
  @ApiProperty({ type: Number })
  id!: number;

  @ApiProperty({ type: Number })
  userId!: number;

  @ApiProperty({ enum: WalletTransactionTypeEnum })
  type!: WalletTransactionTypeEnum;

  @ApiProperty({ type: Number })
  amountVnd!: number;

  @ApiProperty({ type: Number })
  balanceAfterVnd!: number;

  @ApiProperty({ type: Number, nullable: true })
  orderId!: number | null;

  @ApiProperty({ type: String, nullable: true })
  reason!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class WalletMeDto {
  @ApiProperty({ type: Number })
  balanceVnd!: number;

  @ApiProperty({ type: Number })
  availableBalanceVnd!: number;

  @ApiProperty({ enum: WalletStatusEnum })
  status!: WalletStatusEnum;

  @ApiProperty({ type: Date, nullable: true })
  expiresAt!: Date | null;

  @ApiProperty({ type: Number, nullable: true })
  daysLeft!: number | null;
}

export class ReferralProfileDto {
  @ApiProperty({ type: Number })
  userId!: number;

  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: Boolean })
  isActive!: boolean;
}
