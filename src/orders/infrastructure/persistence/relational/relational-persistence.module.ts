import { Module } from '@nestjs/common';
import { OrderRepository } from '../order.repository';
import { OrdersRelationalRepository } from './repositories/order.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from './entities/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity])],
  providers: [
    {
      provide: OrderRepository,
      useClass: OrdersRelationalRepository,
    },
  ],
  exports: [OrderRepository],
})
export class RelationalOrderPersistenceModule {}
