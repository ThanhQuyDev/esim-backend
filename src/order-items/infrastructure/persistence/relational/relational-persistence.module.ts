import { Module } from '@nestjs/common';
import { OrderItemRepository } from '../order-item.repository';
import { OrderItemsRelationalRepository } from './repositories/order-item.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItemEntity } from './entities/order-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OrderItemEntity])],
  providers: [
    {
      provide: OrderItemRepository,
      useClass: OrderItemsRelationalRepository,
    },
  ],
  exports: [OrderItemRepository],
})
export class RelationalOrderItemPersistenceModule {}
