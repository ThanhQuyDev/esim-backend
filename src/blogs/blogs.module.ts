import {
  // do not remove this comment
  Module,
} from '@nestjs/common';
import { BlogsService } from './blogs.service';
import { BlogsController } from './blogs.controller';
import { RelationalBlogPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { MiniTagsModule } from '../mini-tags/mini-tags.module';

@Module({
  imports: [
    // do not remove this comment
    RelationalBlogPersistenceModule,
    MiniTagsModule,
  ],
  controllers: [BlogsController],
  providers: [BlogsService],
  exports: [BlogsService, RelationalBlogPersistenceModule],
})
export class BlogsModule {}
