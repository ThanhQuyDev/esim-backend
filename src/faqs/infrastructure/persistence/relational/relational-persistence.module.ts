import { Module } from '@nestjs/common';
import { FaqRepository } from '../faq.repository';
import { FaqRelationalRepository } from './repositories/faq.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FaqEntity } from './entities/faq.entity';
import { BlogEntity } from '../../../../blogs/infrastructure/persistence/relational/entities/blog.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FaqEntity, BlogEntity])],
  providers: [
    {
      provide: FaqRepository,
      useClass: FaqRelationalRepository,
    },
  ],
  exports: [FaqRepository],
})
export class RelationalFaqPersistenceModule {}
