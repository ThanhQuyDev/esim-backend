import { Module } from '@nestjs/common';
import { HeroBannerRepository } from '../hero-banner.repository';
import { HeroBannerRelationalRepository } from './repositories/hero-banner.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeroBannerEntity } from './entities/hero-banner.entity';

@Module({
  imports: [TypeOrmModule.forFeature([HeroBannerEntity])],
  providers: [
    {
      provide: HeroBannerRepository,
      useClass: HeroBannerRelationalRepository,
    },
  ],
  exports: [HeroBannerRepository],
})
export class RelationalHeroBannerPersistenceModule {}
