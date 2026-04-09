import {
  // common
  Injectable,
} from '@nestjs/common';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { BlogRepository } from './infrastructure/persistence/blog.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Blog } from './domain/blog';

@Injectable()
export class BlogsService {
  constructor(
    // Dependencies here
    private readonly blogRepository: BlogRepository,
  ) {}

  async create(createBlogDto: CreateBlogDto) {
    // Do not remove comment below.
    // <creating-property />

    return this.blogRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      language: createBlogDto.language,

      publishedAt: createBlogDto.publishedAt,

      isPublished: createBlogDto.isPublished,

      author: createBlogDto.author,

      tags: createBlogDto.tags,

      coverImage: createBlogDto.coverImage,

      excerpt: createBlogDto.excerpt,

      content: createBlogDto.content,

      slug: createBlogDto.slug,

      title: createBlogDto.title,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.blogRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: Blog['id']) {
    return this.blogRepository.findById(id);
  }

  findByIds(ids: Blog['id'][]) {
    return this.blogRepository.findByIds(ids);
  }

  async update(
    id: Blog['id'],

    updateBlogDto: UpdateBlogDto,
  ) {
    // Do not remove comment below.
    // <updating-property />

    return this.blogRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      language: updateBlogDto.language,

      publishedAt: updateBlogDto.publishedAt,

      isPublished: updateBlogDto.isPublished,

      author: updateBlogDto.author,

      tags: updateBlogDto.tags,

      coverImage: updateBlogDto.coverImage,

      excerpt: updateBlogDto.excerpt,

      content: updateBlogDto.content,

      slug: updateBlogDto.slug,

      title: updateBlogDto.title,
    });
  }

  remove(id: Blog['id']) {
    return this.blogRepository.remove(id);
  }
}
