import { Module } from '@nestjs/common';
import { MiniTagsService } from './mini-tags.service';
import { MiniTagsController } from './mini-tags.controller';
import { RelationalMiniTagPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalMiniTagPersistenceModule],
  controllers: [MiniTagsController],
  providers: [MiniTagsService],
  exports: [MiniTagsService, RelationalMiniTagPersistenceModule],
})
export class MiniTagsModule {}
