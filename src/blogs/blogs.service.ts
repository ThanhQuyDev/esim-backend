import {
  // common
  Injectable,
} from '@nestjs/common';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { BlogRepository } from './infrastructure/persistence/blog.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Blog } from './domain/blog';
import { MiniTagsService } from '../mini-tags/mini-tags.service';
import { Plan } from '../plans/domain/plan';

@Injectable()
export class BlogsService {
  constructor(
    private readonly blogRepository: BlogRepository,
    private readonly miniTagsService: MiniTagsService,
  ) {}

  async create(createBlogDto: CreateBlogDto) {
    // Do not remove comment below.
    // <creating-property />

    const miniTag = createBlogDto.miniTagId
      ? await this.miniTagsService.findById(createBlogDto.miniTagId)
      : null;

    const plans = createBlogDto.planIds?.length
      ? createBlogDto.planIds.map((id) => {
          const p = new Plan();
          p.id = id;
          return p;
        })
      : [];

    return this.blogRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      language: createBlogDto.language,
      publishedAt: createBlogDto.publishedAt,
      isPublished: createBlogDto.isPublished,
      author: createBlogDto.author,
      category: createBlogDto.category,
      coverImage: createBlogDto.coverImage,
      excerpt: createBlogDto.excerpt,
      content: createBlogDto.content,
      slug: createBlogDto.slug,
      title: createBlogDto.title,
      timeRead: createBlogDto.timeRead,
      miniTag,
      plans,
    });
  }

  findAllWithPagination({
    paginationOptions,
    category,
  }: {
    paginationOptions: IPaginationOptions;
    category?: string;
  }) {
    return this.blogRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
      category,
    });
  }

  findById(id: Blog['id']) {
    return this.blogRepository.findById(id);
  }

  findBySlug(slug: string) {
    return this.blogRepository.findBySlug(slug);
  }

  findByIds(ids: Blog['id'][]) {
    return this.blogRepository.findByIds(ids);
  }

  async update(id: Blog['id'], updateBlogDto: UpdateBlogDto) {
    // Do not remove comment below.
    // <updating-property />

    const miniTag =
      updateBlogDto.miniTagId !== undefined
        ? updateBlogDto.miniTagId
          ? await this.miniTagsService.findById(updateBlogDto.miniTagId)
          : null
        : undefined;

    const plans = updateBlogDto.planIds?.length
      ? updateBlogDto.planIds.map((id) => {
          const p = new Plan();
          p.id = id;
          return p;
        })
      : updateBlogDto.planIds === null
        ? []
        : undefined;

    return this.blogRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      language: updateBlogDto.language,
      publishedAt: updateBlogDto.publishedAt,
      isPublished: updateBlogDto.isPublished,
      author: updateBlogDto.author,
      category: updateBlogDto.category,
      coverImage: updateBlogDto.coverImage,
      excerpt: updateBlogDto.excerpt,
      content: updateBlogDto.content,
      slug: updateBlogDto.slug,
      title: updateBlogDto.title,
      timeRead: updateBlogDto.timeRead,
      miniTag,
      plans,
    });
  }

  remove(id: Blog['id']) {
    return this.blogRepository.remove(id);
  }

  findCategories() {
    return this.blogRepository.findCategories();
  }
}
