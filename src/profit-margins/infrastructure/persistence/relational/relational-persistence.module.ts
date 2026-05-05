import { Module } from '@nestjs/common';
import { ProfitMarginRepository } from '../profit-margin.repository';
import { ProfitMarginsRelationalRepository } from './repositories/profit-margin.repository';
import { ProfitMarginTierRepository } from '../profit-margin-tier.repository';
import { ProfitMarginTiersRelationalRepository } from './repositories/profit-margin-tier.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfitMarginEntity } from './entities/profit-margin.entity';
import { ProfitMarginTierEntity } from './entities/profit-margin-tier.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProfitMarginEntity, ProfitMarginTierEntity]),
  ],
  providers: [
    {
      provide: ProfitMarginRepository,
      useClass: ProfitMarginsRelationalRepository,
    },
    {
      provide: ProfitMarginTierRepository,
      useClass: ProfitMarginTiersRelationalRepository,
    },
  ],
  exports: [ProfitMarginRepository, ProfitMarginTierRepository],
})
export class RelationalProfitMarginPersistenceModule {}
