import { Module } from '@nestjs/common';
import { EsimRepository } from '../esim.repository';
import { EsimsRelationalRepository } from './repositories/esim.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EsimEntity } from './entities/esim.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EsimEntity])],
  providers: [
    {
      provide: EsimRepository,
      useClass: EsimsRelationalRepository,
    },
  ],
  exports: [EsimRepository],
})
export class RelationalEsimPersistenceModule {}
