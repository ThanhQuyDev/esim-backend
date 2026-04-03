import { Module } from '@nestjs/common';
import { DestinationRepository } from '../destination.repository';
import { DestinationsRelationalRepository } from './repositories/destination.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DestinationEntity } from './entities/destination.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DestinationEntity])],
  providers: [
    {
      provide: DestinationRepository,
      useClass: DestinationsRelationalRepository,
    },
  ],
  exports: [DestinationRepository],
})
export class RelationalDestinationPersistenceModule {}
