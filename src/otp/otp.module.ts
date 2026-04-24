import { Module } from '@nestjs/common';
import { RelationalOtpPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { OtpService } from './otp.service';

const infrastructurePersistenceModule = RelationalOtpPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule],
  providers: [OtpService],
  exports: [OtpService, infrastructurePersistenceModule],
})
export class OtpModule {}
