import { Module } from '@nestjs/common';
import { BlogRepository } from '../blog.repository';
import { BlogRelationalRepository } from './repositories/blog.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogEntity } from './entities/blog.entity';
import { MiniTagEntity } from '../../../../mini-tags/infrastructure/persistence/relational/entities/mini-tag.entity';
import { PlanEntity } from '../../../../plans/infrastructure/persistence/relational/entities/plan.entity';
import { FaqEntity } from '../../../../faqs/infrastructure/persistence/relational/entities/faq.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BlogEntity,
      MiniTagEntity,
      PlanEntity,
      FaqEntity,
    ]),
  ],
  providers: [
    {
      provide: BlogRepository,
      useClass: BlogRelationalRepository,
    },
  ],
  exports: [BlogRepository],
})
export class RelationalBlogPersistenceModule {}
