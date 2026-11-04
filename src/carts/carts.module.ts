import { Module } from '@nestjs/common';
import { CartsController } from './carts.controller';
import { CartsService } from './carts.service';
import { RelationalCartPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [RelationalCartPersistenceModule, PlansModule],
  controllers: [CartsController],
  providers: [CartsService],
  exports: [CartsService],
})
export class CartsModule {}
