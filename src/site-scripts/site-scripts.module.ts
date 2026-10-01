import { Module } from '@nestjs/common';
import { SiteScriptsService } from './site-scripts.service';
import { SiteScriptsController } from './site-scripts.controller';
import { RelationalSiteScriptPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalSiteScriptPersistenceModule],
  controllers: [SiteScriptsController],
  providers: [SiteScriptsService],
  exports: [SiteScriptsService, RelationalSiteScriptPersistenceModule],
})
export class SiteScriptsModule {}
