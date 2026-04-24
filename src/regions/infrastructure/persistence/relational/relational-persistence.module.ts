import { Module } from '@nestjs/common';
import { RegionRepository } from '../region.repository';
import { RegionsRelationalRepository } from './repositories/region.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegionEntity } from './entities/region.entity';
import { DestinationEntity } from '../../../../destinations/infrastructure/persistence/relational/entities/destination.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RegionEntity, DestinationEntity])],
  providers: [
    {
      provide: RegionRepository,
      useClass: RegionsRelationalRepository,
    },
  ],
  exports: [RegionRepository],
})
export class RelationalRegionPersistenceModule {}
