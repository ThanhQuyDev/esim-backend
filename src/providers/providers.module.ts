import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlansModule } from '../plans/plans.module';
import { ProviderSalesStatusEntity } from './infrastructure/persistence/relational/entities/provider-sales-status.entity';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProviderSalesStatusEntity]), PlansModule],
  controllers: [ProvidersController],
  providers: [ProvidersService],
  exports: [ProvidersService],
})
export class ProvidersModule {}
