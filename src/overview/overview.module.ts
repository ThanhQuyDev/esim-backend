import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EsimEntity } from '../esims/infrastructure/persistence/relational/entities/esim.entity';
import { OrderItemEntity } from '../order-items/infrastructure/persistence/relational/entities/order-item.entity';
import { OrderEntity } from '../orders/infrastructure/persistence/relational/entities/order.entity';
import { PlanEntity } from '../plans/infrastructure/persistence/relational/entities/plan.entity';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';
import { OverviewInsightsService } from './overview-insights.service';
import { SiteVisitsPublicController } from './site-visits-public.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      PlanEntity,
      UserEntity,
      EsimEntity,
    ]),
  ],
  controllers: [OverviewController, SiteVisitsPublicController],
  providers: [OverviewService, OverviewInsightsService],
  exports: [OverviewService],
})
export class OverviewModule {}
