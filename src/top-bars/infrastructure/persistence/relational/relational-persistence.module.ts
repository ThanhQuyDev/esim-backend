import { Module } from '@nestjs/common';
import { TopBarRepository } from '../top-bar.repository';
import { TopBarRelationalRepository } from './repositories/top-bar.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TopBarEntity } from './entities/top-bar.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TopBarEntity])],
  providers: [
    {
      provide: TopBarRepository,
      useClass: TopBarRelationalRepository,
    },
  ],
  exports: [TopBarRepository],
})
export class RelationalTopBarPersistenceModule {}
