import { OrdersModule } from '../orders/orders.module';
import {
  // do not remove this comment
  Module,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { AdminInvoicesController } from './admin-invoices.controller';
import { RelationalInvoicePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [
    OrdersModule,

    // do not remove this comment
    RelationalInvoicePersistenceModule,
  ],
  controllers: [InvoicesController, AdminInvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService, RelationalInvoicePersistenceModule],
})
export class InvoicesModule {}
