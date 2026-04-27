import { Module } from '@nestjs/common';
import { SeoConfigsController } from './seo-configs.controller';
import { SeoConfigsService } from './seo-configs.service';
import { RelationalSeoConfigPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalSeoConfigPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule],
  controllers: [SeoConfigsController],
  providers: [SeoConfigsService],
  exports: [SeoConfigsService, infrastructurePersistenceModule],
})
export class SeoConfigsModule {}
