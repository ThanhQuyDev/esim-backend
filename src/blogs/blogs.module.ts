import {
  // do not remove this comment
  Module,
} from '@nestjs/common';
import { BlogsService } from './blogs.service';
import { BlogsController } from './blogs.controller';
import { RelationalBlogPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { MiniTagsModule } from '../mini-tags/mini-tags.module';
import { UsersModule } from '../users/users.module';
import { AuthorsModule } from '../authors/authors.module';
import { SeoConfigsModule } from '../seo-configs/seo-configs.module';

@Module({
  imports: [
    // do not remove this comment
    RelationalBlogPersistenceModule,
    MiniTagsModule,
    UsersModule,
    AuthorsModule,
    // Deleting a post removes its SEO config (#055).
    SeoConfigsModule,
  ],
  controllers: [BlogsController],
  providers: [BlogsService],
  exports: [BlogsService, RelationalBlogPersistenceModule],
})
export class BlogsModule {}
