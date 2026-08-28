import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { FilterBlogDto, SortBlogDto } from './dto/find-all-blogs.dto';
import { BlogRepository } from './infrastructure/persistence/blog.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Blog } from './domain/blog';
import { MiniTagsService } from '../mini-tags/mini-tags.service';
import { Plan } from '../plans/domain/plan';
import { Faq } from '../faqs/domain/faq';
import { AuthorsService } from '../authors/authors.service';

@Injectable()
export class BlogsService {
  constructor(
    private readonly blogRepository: BlogRepository,
    private readonly miniTagsService: MiniTagsService,
    private readonly authorsService: AuthorsService,
  ) {}

  async create(createBlogDto: CreateBlogDto, userId: number) {
    // Do not remove comment below.
    // <creating-property />

    const authorProfile = await this.authorsService.findByUserId(userId);
    if (!authorProfile) {
      throw new ForbiddenException('Author profile is required');
    }

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

    const faqs = createBlogDto.faqIds?.length
      ? createBlogDto.faqIds.map((id) => {
          const f = new Faq();
          f.id = id;
          return f;
        })
      : [];

    return this.blogRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      language: createBlogDto.language,
      publishedAt: createBlogDto.publishedAt,
      isPublished: createBlogDto.isPublished,
      authorProfile,
      authorProfileId: authorProfile.id,
      author: authorProfile.name,
      authorAvatar: authorProfile.avatar,
      category: createBlogDto.category,
      parent: createBlogDto.parent,
      coverImage: createBlogDto.coverImage,
      excerpt: createBlogDto.excerpt,
      content: createBlogDto.content,
      slug: createBlogDto.slug,
      title: createBlogDto.title,
      timeRead: createBlogDto.timeRead,
      faqEnabled: createBlogDto.faqEnabled ?? false,
      isPopular: createBlogDto.isPopular ?? false,
      miniTag,
      plans,
      faqs,
    });
  }

  findAllWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
    lang,
  }: {
    filterOptions?: FilterBlogDto | null;
    sortOptions?: SortBlogDto[] | null;
    paginationOptions: IPaginationOptions;
    lang?: string;
  }) {
    return this.blogRepository.findAllWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
      lang,
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

  async update(id: Blog['id'], updateBlogDto: UpdateBlogDto, userId: number) {
    const current = await this.blogRepository.findById(id);
    if (!current) throw new NotFoundException();
    const authorProfile = await this.authorsService.findByUserId(userId);
    if (!authorProfile || current.authorProfileId !== authorProfile.id) {
      throw new ForbiddenException();
    }

    const miniTag =
      updateBlogDto.miniTagId !== undefined
        ? updateBlogDto.miniTagId
          ? await this.miniTagsService.findById(updateBlogDto.miniTagId)
          : null
        : undefined;

    const plans =
      updateBlogDto.planIds === undefined
        ? undefined
        : (updateBlogDto.planIds ?? []).map((id) => {
            const p = new Plan();
            p.id = id;
            return p;
          });

    const faqs =
      updateBlogDto.faqIds === undefined
        ? undefined
        : (updateBlogDto.faqIds ?? []).map((id) => {
            const f = new Faq();
            f.id = id;
            return f;
          });

    return this.blogRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      language: updateBlogDto.language,
      publishedAt: updateBlogDto.publishedAt,
      isPublished: updateBlogDto.isPublished,
      authorProfile,
      authorProfileId: authorProfile.id,
      author: authorProfile.name,
      authorAvatar: authorProfile.avatar,
      category: updateBlogDto.category,
      parent: updateBlogDto.parent,
      coverImage: updateBlogDto.coverImage,
      excerpt: updateBlogDto.excerpt,
      content: updateBlogDto.content,
      slug: updateBlogDto.slug,
      title: updateBlogDto.title,
      timeRead: updateBlogDto.timeRead,
      faqEnabled: updateBlogDto.faqEnabled,
      isPopular: updateBlogDto.isPopular,
      miniTag,
      plans,
      faqs,
    });
  }

  remove(id: Blog['id'], userId: number) {
    return this.updateOwnership(id, userId).then(() =>
      this.blogRepository.remove(id),
    );
  }

  private async updateOwnership(id: Blog['id'], userId: number) {
    const current = await this.blogRepository.findById(id);
    const profile = await this.authorsService.findByUserId(userId);
    if (!current || !profile || current.authorProfileId !== profile.id) {
      throw new ForbiddenException();
    }
  }

  findCategories(lang?: string) {
    return this.blogRepository.findCategories(lang);
  }

  findParentsByCategory(lang?: string) {
    return this.blogRepository.findParentsByCategory(lang);
  }
}
