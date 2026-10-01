import { Module } from '@nestjs/common';
import { SeoConfigsController } from './seo-configs.controller';
import { SeoConfigsService } from './seo-configs.service';
import { RelationalSeoConfigPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { DestinationsModule } from '../destinations/destinations.module';
import { RegionsModule } from '../regions/regions.module';

const infrastructurePersistenceModule = RelationalSeoConfigPersistenceModule;

@Module({
  // Needed to resolve which country / area a SEO url is for (#048).
  imports: [infrastructurePersistenceModule, DestinationsModule, RegionsModule],
  controllers: [SeoConfigsController],
  providers: [SeoConfigsService],
  exports: [SeoConfigsService, infrastructurePersistenceModule],
})
export class SeoConfigsModule {}
