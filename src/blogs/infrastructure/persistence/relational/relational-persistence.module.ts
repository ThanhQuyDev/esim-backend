import { Module } from '@nestjs/common';
import { BlogRepository } from '../blog.repository';
import { BlogRelationalRepository } from './repositories/blog.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogEntity } from './entities/blog.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BlogEntity])],
  providers: [
    {
      provide: BlogRepository,
      useClass: BlogRelationalRepository,
    },
  ],
  exports: [BlogRepository],
})
export class RelationalBlogPersistenceModule {}
