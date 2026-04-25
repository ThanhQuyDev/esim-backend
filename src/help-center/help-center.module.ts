import { Module } from '@nestjs/common';
import { HelpCenterService } from './help-center.service';
import { HelpCenterController } from './help-center.controller';
import { RelationalHelpCenterPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalHelpCenterPersistenceModule],
  controllers: [HelpCenterController],
  providers: [HelpCenterService],
  exports: [HelpCenterService, RelationalHelpCenterPersistenceModule],
})
export class HelpCenterModule {}
