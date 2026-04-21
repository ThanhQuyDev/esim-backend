import { Module, forwardRef } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { RelationalOrderPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { EsimProvidersModule } from '../esim-providers/esim-providers.module';
import { PlansModule } from '../plans/plans.module';
import { OrderItemsModule } from '../order-items/order-items.module';
import { CouponsModule } from '../coupons/coupons.module';

const infrastructurePersistenceModule = RelationalOrderPersistenceModule;

@Module({
  imports: [
    infrastructurePersistenceModule,
    EsimProvidersModule,
    PlansModule,
    OrderItemsModule,
    forwardRef(() => CouponsModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService, infrastructurePersistenceModule],
})
export class OrdersModule {}
