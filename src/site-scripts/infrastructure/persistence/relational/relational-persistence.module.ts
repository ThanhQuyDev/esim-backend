import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteScriptRepository } from '../site-script.repository';
import { SiteScriptRelationalRepository } from './repositories/site-script.repository';
import { SiteScriptEntity } from './entities/site-script.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SiteScriptEntity])],
  providers: [
    {
      provide: SiteScriptRepository,
      useClass: SiteScriptRelationalRepository,
    },
  ],
  exports: [SiteScriptRepository],
})
export class RelationalSiteScriptPersistenceModule {}
