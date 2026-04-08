import { Module } from '@nestjs/common';
import { ProfitMarginRepository } from '../profit-margin.repository';
import { ProfitMarginsRelationalRepository } from './repositories/profit-margin.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfitMarginEntity } from './entities/profit-margin.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProfitMarginEntity])],
  providers: [
    {
      provide: ProfitMarginRepository,
      useClass: ProfitMarginsRelationalRepository,
    },
  ],
  exports: [ProfitMarginRepository],
})
export class RelationalProfitMarginPersistenceModule {}
