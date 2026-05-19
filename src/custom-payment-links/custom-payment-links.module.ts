import { UsersModule } from '../users/users.module';
import {
  // do not remove this comment
  Module,
} from '@nestjs/common';
import { CustomPaymentLinksService } from './custom-payment-links.service';
import { CustomPaymentLinksController } from './custom-payment-links.controller';
import { AdminPaymentsController } from './admin-payments.controller';
import { RelationalCustomPaymentLinkPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { OnepayModule } from '../payment/onepay.module';

@Module({
  imports: [
    UsersModule,
    OnepayModule,

    // do not remove this comment
    RelationalCustomPaymentLinkPersistenceModule,
  ],
  controllers: [CustomPaymentLinksController, AdminPaymentsController],
  providers: [CustomPaymentLinksService],
  exports: [
    CustomPaymentLinksService,
    RelationalCustomPaymentLinkPersistenceModule,
  ],
})
export class CustomPaymentLinksModule {}
