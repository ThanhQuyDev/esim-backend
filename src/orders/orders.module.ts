import { Module, forwardRef } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
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
import { WalletsModule } from '../wallets/wallets.module';
import { RelationalInvoicePersistenceModule } from '../invoices/infrastructure/persistence/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalOrderPersistenceModule;

@Module({
  imports: [
    infrastructurePersistenceModule,
    forwardRef(() => EsimProvidersModule),
    PlansModule,
    OrderItemsModule,
    forwardRef(() => CouponsModule),
    EsimsModule,
    CartsModule,
    MailModule,
    UsersModule,
    WalletsModule,
    // Imported here (not via InvoicesModule) to avoid the circular dep
    // OrdersModule -> InvoicesModule -> OrdersModule. This persistence module
    // is a leaf — it only exposes the repository.
    RelationalInvoicePersistenceModule,
  ],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService],
  exports: [OrdersService, infrastructurePersistenceModule],
})
export class OrdersModule {}
