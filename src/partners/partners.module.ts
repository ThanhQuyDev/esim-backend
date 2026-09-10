import { Module } from '@nestjs/common';
import { PartnerTierEvaluationEntity } from './infrastructure/persistence/relational/entities/partner-tier-evaluation.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartnersController } from './partners.controller';
import { AdminPartnersController } from './admin-partners.controller';
import { PartnerLinksPublicController } from './partner-links-public.controller';
import { PartnersService } from './partners.service';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { PartnerEntity } from './infrastructure/persistence/relational/entities/partner.entity';
import { PartnerWalletEntity } from './infrastructure/persistence/relational/entities/partner-wallet.entity';
import { PartnerWalletTransactionEntity } from './infrastructure/persistence/relational/entities/partner-wallet-transaction.entity';
import { PartnerDepositRequestEntity } from './infrastructure/persistence/relational/entities/partner-deposit-request.entity';
import { PartnerTierEntity } from './infrastructure/persistence/relational/entities/partner-tier.entity';
import { PartnerLinkEntity } from './infrastructure/persistence/relational/entities/partner-link.entity';
import { PartnerLinkClickEntity } from './infrastructure/persistence/relational/entities/partner-link-click.entity';
import { OrderPartnerCommissionEntity } from './infrastructure/persistence/relational/entities/order-partner-commission.entity';
import { PartnerPayoutEntity } from './infrastructure/persistence/relational/entities/partner-payout.entity';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    // Approval and rejection are told to the applicant by email (#095).
    MailModule,
    TypeOrmModule.forFeature([
      UserEntity,
      PartnerEntity,
      PartnerWalletEntity,
      PartnerWalletTransactionEntity,
      PartnerDepositRequestEntity,
      PartnerTierEntity,
      PartnerLinkEntity,
      PartnerLinkClickEntity,
      OrderPartnerCommissionEntity,
      PartnerPayoutEntity,
      PartnerTierEvaluationEntity,
    ]),
  ],
  controllers: [
    PartnersController,
    AdminPartnersController,
    PartnerLinksPublicController,
  ],
  providers: [PartnersService],
  exports: [PartnersService],
})
export class PartnersModule {}
