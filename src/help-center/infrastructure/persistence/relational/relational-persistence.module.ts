import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HelpCenterEntity } from './entities/help-center.entity';
import { HelpCenterRepository } from '../help-center.repository';
import { HelpCenterRelationalRepository } from './repositories/help-center.repository';

@Module({
  imports: [TypeOrmModule.forFeature([HelpCenterEntity])],
  providers: [
    {
      provide: HelpCenterRepository,
      useClass: HelpCenterRelationalRepository,
    },
  ],
  exports: [HelpCenterRepository],
})
export class RelationalHelpCenterPersistenceModule {}
