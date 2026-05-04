import {
  // do not remove this comment
  Module,
} from '@nestjs/common';
import { FootersService } from './footers.service';
import { FootersController } from './footers.controller';
import { RelationalFooterPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [
    // do not remove this comment
    RelationalFooterPersistenceModule,
  ],
  controllers: [FootersController],
  providers: [FootersService],
  exports: [FootersService, RelationalFooterPersistenceModule],
})
export class FootersModule {}
