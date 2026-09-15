import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { FilterBlogDto, SortBlogDto } from './dto/find-all-blogs.dto';
import {
  BlogRepository,
  LegacyBlogAuthor,
} from './infrastructure/persistence/blog.repository';
import { toAuthorSlug } from '../authors/author-slug';
import { AuthorProfile } from '../authors/domain/author-profile';

/**
 * What `/blogs/authors/:slug` returns: a real author profile, or a stand-in for
 * a byline on articles that predate profiles — which has no ids (#030).
 */
export type BlogAuthorView =
  | AuthorProfile
  | (Omit<AuthorProfile, 'id' | 'userId'> & { id: null; userId: null });
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Blog } from './domain/blog';
import { MiniTagsService } from '../mini-tags/mini-tags.service';
import { Plan } from '../plans/domain/plan';
import { Faq } from '../faqs/domain/faq';
import { AuthorsService } from '../authors/authors.service';

/**
 * Keep the publication date independent from updatedAt. The first transition
 * to published gets a timestamp; later edits retain it unless CMS explicitly
 * supplies another publication date.
 */
export function resolveBlogPublishedAt({
  requestedPublishedAt,
  requestedIsPublished,
  currentPublishedAt,
  currentIsPublished,
  now = new Date(),
}: {
  requestedPublishedAt?: Date | null;
  requestedIsPublished?: boolean;
  currentPublishedAt?: Date | null;
  currentIsPublished?: boolean;
  now?: Date;
}): Date | null | undefined {
  if (requestedPublishedAt !== undefined) return requestedPublishedAt;
  if (requestedIsPublished === true && currentIsPublished !== true) {
    return currentPublishedAt ?? now;
  }
  return currentPublishedAt;
}

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
      publishedAt: resolveBlogPublishedAt({
        requestedPublishedAt: createBlogDto.publishedAt,
        requestedIsPublished: createBlogDto.isPublished,
        currentIsPublished: false,
      }),
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

  async findAllWithPagination({
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
    let filters = filterOptions;
    if (filterOptions?.authorSlug) {
      const slug =
        toAuthorSlug(filterOptions.authorSlug) || filterOptions.authorSlug;
      const legacy = await this.legacyAuthorsFor(slug);
      filters = {
        ...filterOptions,
        authorSlug: slug,
        legacyAuthorNames: legacy.map((author) => author.name),
      };
    }

    return this.blogRepository.findAllWithPagination({
      filterOptions: filters,
      sortOptions,
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
      lang,
    });
  }

  /**
   * The author behind `/blog/author/<slug>` (#030).
   *
   * Every article published before author profiles existed carries only a
   * byline ("Duc Tho"), so its author link led to a 404 and the author page
   * never listed anything. A profile still wins; otherwise the byline whose slug
   * matches stands in, taking the name used on the most articles.
   */
  async findAuthorBySlug(slug: string): Promise<BlogAuthorView | null> {
    const profile = await this.authorsService.findBySlug(slug);
    if (profile) return profile;

    const [legacy] = await this.legacyAuthorsFor(slug);
    if (!legacy) return null;

    return {
      id: null,
      userId: null,
      name: legacy.name,
      nameEn: null,
      slug: toAuthorSlug(slug),
      avatar: legacy.avatar,
      description: null,
      descriptionEn: null,
    };
  }

  private async legacyAuthorsFor(slug: string): Promise<LegacyBlogAuthor[]> {
    const target = toAuthorSlug(slug);
    if (!target) return [];
    const authors = await this.blogRepository.findLegacyAuthors();
    return authors
      .filter((author) => toAuthorSlug(author.name) === target)
      .sort((a, b) => b.blogs - a.blogs);
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
      publishedAt: resolveBlogPublishedAt({
        requestedPublishedAt: updateBlogDto.publishedAt,
        requestedIsPublished: updateBlogDto.isPublished,
        currentPublishedAt: current.publishedAt,
        currentIsPublished: current.isPublished,
      }),
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
