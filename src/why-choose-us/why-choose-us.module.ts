import {
  // do not remove this comment
  Module,
} from '@nestjs/common';
import { WhyChooseUsService } from './why-choose-us.service';
import { WhyChooseUsController } from './why-choose-us.controller';
import { RelationalWhyChooseUsPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [
    // do not remove this comment
    RelationalWhyChooseUsPersistenceModule,
  ],
  controllers: [WhyChooseUsController],
  providers: [WhyChooseUsService],
  exports: [WhyChooseUsService, RelationalWhyChooseUsPersistenceModule],
})
export class WhyChooseUsModule {}
