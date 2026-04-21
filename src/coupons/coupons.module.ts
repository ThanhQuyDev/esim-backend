import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { CouponEntity } from './infrastructure/persistence/relational/entities/coupon.entity';
import { CouponsRelationalRepository } from './infrastructure/persistence/relational/repositories/coupon.repository';
import { CouponRepository } from './infrastructure/persistence/coupon.repository';
import { OrderEntity } from '../orders/infrastructure/persistence/relational/entities/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CouponEntity, OrderEntity])],
  controllers: [CouponsController],
  providers: [
    CouponsService,
    {
      provide: CouponRepository,
      useClass: CouponsRelationalRepository,
    },
  ],
  exports: [CouponsService],
})
export class CouponsModule {}
