import {
  // do not remove this comment
  Module,
} from '@nestjs/common';
import { FaqsService } from './faqs.service';
import { FaqsController } from './faqs.controller';
import { RelationalFaqPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [
    // do not remove this comment
    RelationalFaqPersistenceModule,
  ],
  controllers: [FaqsController],
  providers: [FaqsService],
  exports: [FaqsService, RelationalFaqPersistenceModule],
})
export class FaqsModule {}
