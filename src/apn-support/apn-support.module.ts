import { Module } from '@nestjs/common';
import { ApnSupportService } from './apn-support.service';
import { ApnSupportController } from './apn-support.controller';
import { RelationalApnSupportPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalApnSupportPersistenceModule],
  controllers: [ApnSupportController],
  providers: [ApnSupportService],
  exports: [ApnSupportService, RelationalApnSupportPersistenceModule],
})
export class ApnSupportModule {}
