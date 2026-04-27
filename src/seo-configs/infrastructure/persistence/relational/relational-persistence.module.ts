import { Module } from '@nestjs/common';
import { SeoConfigRepository } from '../seo-config.repository';
import { SeoConfigsRelationalRepository } from './repositories/seo-config.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeoConfigEntity } from './entities/seo-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SeoConfigEntity])],
  providers: [
    {
      provide: SeoConfigRepository,
      useClass: SeoConfigsRelationalRepository,
    },
  ],
  exports: [SeoConfigRepository],
})
export class RelationalSeoConfigPersistenceModule {}
