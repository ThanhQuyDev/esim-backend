import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlansModule } from '../plans/plans.module';
import { ProviderSurchargeEntity } from './infrastructure/persistence/relational/entities/provider-surcharge.entity';
import { ProviderSurchargesController } from './provider-surcharges.controller';
import { ProviderSurchargesService } from './provider-surcharges.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProviderSurchargeEntity]), PlansModule],
  controllers: [ProviderSurchargesController],
  providers: [ProviderSurchargesService],
  exports: [ProviderSurchargesService],
})
export class ProviderSurchargesModule {}
