import { ApiProperty } from '@nestjs/swagger';
import { WalletStatusEnum } from '../wallets.enum';

export class Wallet {
  @ApiProperty({ type: Number })
  id!: number;

  @ApiProperty({ type: Number })
  userId!: number;

  @ApiProperty({ type: Number, example: 50000 })
  balanceVnd!: number;

  @ApiProperty({ type: String, enum: WalletStatusEnum })
  status!: WalletStatusEnum;

  @ApiProperty({ type: Date, nullable: true })
  expiresAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
