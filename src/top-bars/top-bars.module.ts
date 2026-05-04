import { FilesModule } from '../files/files.module';
import {
  // do not remove this comment
  Module,
} from '@nestjs/common';
import { TopBarsService } from './top-bars.service';
import { TopBarsController } from './top-bars.controller';
import { RelationalTopBarPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [
    FilesModule,

    // do not remove this comment
    RelationalTopBarPersistenceModule,
  ],
  controllers: [TopBarsController],
  providers: [TopBarsService],
  exports: [TopBarsService, RelationalTopBarPersistenceModule],
})
export class TopBarsModule {}
