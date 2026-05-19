import { Module } from '@nestjs/common';
import { CustomPaymentLinkRepository } from '../custom-payment-link.repository';
import { CustomPaymentLinkRelationalRepository } from './repositories/custom-payment-link.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomPaymentLinkEntity } from './entities/custom-payment-link.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CustomPaymentLinkEntity])],
  providers: [
    {
      provide: CustomPaymentLinkRepository,
      useClass: CustomPaymentLinkRelationalRepository,
    },
  ],
  exports: [CustomPaymentLinkRepository],
})
export class RelationalCustomPaymentLinkPersistenceModule {}
