import { Module, forwardRef } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { RelationalOrderPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { EsimProvidersModule } from '../esim-providers/esim-providers.module';
import { PlansModule } from '../plans/plans.module';
import { OrderItemsModule } from '../order-items/order-items.module';
import { CouponsModule } from '../coupons/coupons.module';
import { EsimsModule } from '../esims/esims.module';
import { CartsModule } from '../carts/carts.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';

const infrastructurePersistenceModule = RelationalOrderPersistenceModule;

@Module({
  imports: [
    infrastructurePersistenceModule,
    EsimProvidersModule,
    PlansModule,
    OrderItemsModule,
    forwardRef(() => CouponsModule),
    EsimsModule,
    CartsModule,
    MailModule,
    UsersModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService, infrastructurePersistenceModule],
})
export class OrdersModule {}
