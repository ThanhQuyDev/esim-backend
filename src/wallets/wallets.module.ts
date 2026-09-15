import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from '../orders/infrastructure/persistence/relational/entities/order.entity';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { WalletsController } from './wallets.controller';
import { MembershipTiersController } from './tier/tiers.controller';
import { WalletsService } from './wallets.service';
import { OrderReferralEntity } from './infrastructure/persistence/relational/entities/order-referral.entity';
import { OrderRefundEntity } from './infrastructure/persistence/relational/entities/order-refund.entity';
import { UserReferralProfileEntity } from './infrastructure/persistence/relational/entities/user-referral-profile.entity';
import { UserWalletEntity } from './infrastructure/persistence/relational/entities/user-wallet.entity';
import { WalletHoldEntity } from './infrastructure/persistence/relational/entities/wallet-hold.entity';
import { WalletTransactionEntity } from './infrastructure/persistence/relational/entities/wallet-transaction.entity';
import { UserSpendTransactionEntity } from './infrastructure/persistence/relational/entities/user-spend-transaction.entity';
import { EsimsModule } from '../esims/esims.module';
import { MembershipTierConfigEntity } from './infrastructure/persistence/relational/entities/membership-tier-config.entity';
import { AdminMembershipTiersController } from './tier/admin-membership-tiers.controller';
import { MembershipTierConfigService } from './tier/membership-tier-config.service';

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
      UserEntity,
      UserSpendTransactionEntity,
      MembershipTierConfigEntity,
    ]),
    forwardRef(() => EsimsModule),
  ],
  controllers: [
    WalletsController,
    MembershipTiersController,
    AdminMembershipTiersController,
  ],
  providers: [WalletsService, MembershipTierConfigService],
  exports: [WalletsService, MembershipTierConfigService],
})
export class WalletsModule {}
