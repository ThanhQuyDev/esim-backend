import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from '../orders/infrastructure/persistence/relational/entities/order.entity';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { OrderReferralEntity } from './infrastructure/persistence/relational/entities/order-referral.entity';
import { OrderRefundEntity } from './infrastructure/persistence/relational/entities/order-refund.entity';
import { UserReferralProfileEntity } from './infrastructure/persistence/relational/entities/user-referral-profile.entity';
import { UserWalletEntity } from './infrastructure/persistence/relational/entities/user-wallet.entity';
import { WalletHoldEntity } from './infrastructure/persistence/relational/entities/wallet-hold.entity';
import { WalletTransactionEntity } from './infrastructure/persistence/relational/entities/wallet-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserWalletEntity,
      WalletTransactionEntity,
      WalletHoldEntity,
      UserReferralProfileEntity,
      OrderReferralEntity,
      OrderRefundEntity,
      OrderEntity,
    ]),
  ],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}
