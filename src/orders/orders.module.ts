import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { RelationalOrderPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalOrderPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService, infrastructurePersistenceModule],
})
export class OrdersModule {}
