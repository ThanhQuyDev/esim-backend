import { Module } from '@nestjs/common';
import { OnepayService } from './onepay.service';

/**
 * Tiny module that exposes {@link OnepayService} so it can be reused outside
 * the main PaymentModule (e.g. by the custom-payment-links flow) without
 * pulling in the full payment graph and risking circular imports.
 */
@Module({
  providers: [OnepayService],
  exports: [OnepayService],
})
export class OnepayModule {}
