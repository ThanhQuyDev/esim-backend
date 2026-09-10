import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItemEntity } from '../order-items/infrastructure/persistence/relational/entities/order-item.entity';
import { ProviderDepositEntryEntity } from './infrastructure/persistence/relational/entities/provider-deposit-entry.entity';
import { ProviderDepositsController } from './provider-deposits.controller';
import { ProviderDepositsService } from './provider-deposits.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProviderDepositEntryEntity, OrderItemEntity]),
  ],
  controllers: [ProviderDepositsController],
  providers: [ProviderDepositsService],
  exports: [ProviderDepositsService],
})
export class ProviderDepositsModule {}
