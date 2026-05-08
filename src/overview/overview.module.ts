import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EsimEntity } from '../esims/infrastructure/persistence/relational/entities/esim.entity';
import { OrderItemEntity } from '../order-items/infrastructure/persistence/relational/entities/order-item.entity';
import { OrderEntity } from '../orders/infrastructure/persistence/relational/entities/order.entity';
import { PlanEntity } from '../plans/infrastructure/persistence/relational/entities/plan.entity';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';

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
  controllers: [OverviewController],
  providers: [OverviewService],
  exports: [OverviewService],
})
export class OverviewModule {}
