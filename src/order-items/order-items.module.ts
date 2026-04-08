import { Module } from '@nestjs/common';
import { OrderItemsController } from './order-items.controller';
import { OrderItemsService } from './order-items.service';
import { RelationalOrderItemPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalOrderItemPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule],
  controllers: [OrderItemsController],
  providers: [OrderItemsService],
  exports: [OrderItemsService, infrastructurePersistenceModule],
})
export class OrderItemsModule {}
