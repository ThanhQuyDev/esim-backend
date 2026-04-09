import { Module } from '@nestjs/common';
import { WhyChooseUsRepository } from '../why-choose-us.repository';
import { WhyChooseUsRelationalRepository } from './repositories/why-choose-us.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhyChooseUsEntity } from './entities/why-choose-us.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WhyChooseUsEntity])],
  providers: [
    {
      provide: WhyChooseUsRepository,
      useClass: WhyChooseUsRelationalRepository,
    },
  ],
  exports: [WhyChooseUsRepository],
})
export class RelationalWhyChooseUsPersistenceModule {}
