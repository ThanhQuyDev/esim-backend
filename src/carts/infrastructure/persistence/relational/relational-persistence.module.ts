import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartEntity } from './entities/cart.entity';
import { CartRepository } from '../cart.repository';
import { CartsRelationalRepository } from './repositories/cart.repository';

@Module({
  imports: [TypeOrmModule.forFeature([CartEntity])],
  providers: [
    {
      provide: CartRepository,
      useClass: CartsRelationalRepository,
    },
  ],
  exports: [CartRepository],
})
export class RelationalCartPersistenceModule {}
