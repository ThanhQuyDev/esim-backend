import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { RoleEnum } from '../roles/roles.enum';
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
import { SeoConfigsService } from '../seo-configs/seo-configs.service';
import { blogSeoUrls } from './blog-seo-urls';

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

/** Who is writing (#011): an admin manages every post, an author only their own. */
export type BlogEditor = { id: number; roleId?: number | string | null };

const isAdmin = (editor: BlogEditor) =>
  Number(editor.roleId) === RoleEnum.admin;

@Injectable()
export class BlogsService {
  private readonly logger = new Logger(BlogsService.name);

  constructor(
    private readonly blogRepository: BlogRepository,
    private readonly miniTagsService: MiniTagsService,
    private readonly authorsService: AuthorsService,
    private readonly seoConfigsService: SeoConfigsService,
  ) {}

  async create(createBlogDto: CreateBlogDto, editor: BlogEditor) {
    // Do not remove comment below.
    // <creating-property />

    const authorProfile = await this.resolveAuthorForCreate(
      editor,
      createBlogDto.authorProfileId,
    );

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
      // The durable reference (#047); the repository resolves it to plans and
      // rewrites the join table from it.
      planCodes: createBlogDto.planCodes,
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

  async update(
    id: Blog['id'],
    updateBlogDto: UpdateBlogDto,
    editor: BlogEditor,
  ) {
    const current = await this.blogRepository.findById(id);
    if (!current) throw new NotFoundException();

    // An author edits their own posts and stays credited; an admin edits any
    // post and only changes the credit when they pick another author.
    let authorProfile: AuthorProfile | undefined;
    if (isAdmin(editor)) {
      if (updateBlogDto.authorProfileId !== undefined) {
        authorProfile = await this.findAuthorOrFail(
          updateBlogDto.authorProfileId,
        );
      }
    } else {
      const own = await this.authorsService.findByUserId(editor.id);
      if (!own || current.authorProfileId !== own.id) {
        throw new ForbiddenException();
      }
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
      ...(authorProfile
        ? {
            authorProfile,
            authorProfileId: authorProfile.id,
            author: authorProfile.name,
            authorAvatar: authorProfile.avatar,
          }
        : {}),
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
      planCodes: updateBlogDto.planCodes,
      faqs,
    });
  }

  async remove(id: Blog['id'], editor: BlogEditor): Promise<void> {
    const current = await this.assertCanManage(id, editor);
    await this.blogRepository.remove(id);

    // The post's SEO config would otherwise stay behind in the CMS as clutter
    // (#055). The post is already gone, so a failure here only gets logged.
    const urls = blogSeoUrls(current);
    try {
      const removed = await this.seoConfigsService.removeByUrls(urls);
      if (removed > 0) {
        this.logger.log(
          `Removed ${removed} SEO config(s) of deleted blog ${id}: ${urls.join(', ')}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Blog ${id} deleted but its SEO config could not be removed: ${(error as Error).message}`,
      );
    }
  }

  private async assertCanManage(id: Blog['id'], editor: BlogEditor) {
    const current = await this.blogRepository.findById(id);
    if (!current) throw new NotFoundException();
    if (isAdmin(editor)) return current;

    const profile = await this.authorsService.findByUserId(editor.id);
    if (!profile || current.authorProfileId !== profile.id) {
      throw new ForbiddenException();
    }
    return current;
  }

  /**
   * The author a new post is credited to (#011). An author is always credited
   * themselves. An admin picks one; without a pick their own profile is used if
   * they have one, otherwise the post cannot be saved without choosing.
   */
  private async resolveAuthorForCreate(
    editor: BlogEditor,
    requestedAuthorProfileId?: number,
  ): Promise<AuthorProfile> {
    if (isAdmin(editor)) {
      if (requestedAuthorProfileId) {
        return this.findAuthorOrFail(requestedAuthorProfileId);
      }
      const own = await this.authorsService.findByUserId(editor.id);
      if (own) return own;
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { authorProfileId: 'authorRequired' },
      });
    }

    const own = await this.authorsService.findByUserId(editor.id);
    if (!own) throw new ForbiddenException('Author profile is required');
    return own;
  }

  private async findAuthorOrFail(id: number): Promise<AuthorProfile> {
    const profile = await this.authorsService.findById(id);
    if (!profile) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { authorProfileId: 'authorNotFound' },
      });
    }
    return profile;
  }

  /** Every author profile, for the admin's "Tác giả" select box (#011). */
  findAuthorProfiles() {
    return this.authorsService.findAll();
  }

  /** The author profile of a signed-in author, for scoping their CMS list. */
  findOwnAuthorProfile(userId: number) {
    return this.authorsService.findByUserId(userId);
  }

  findCategories(lang?: string) {
    return this.blogRepository.findCategories(lang);
  }

  /** Authors that have articles, for the CMS filter's select box (#046). */
  findAuthorOptions(lang?: string) {
    return this.blogRepository.findAuthorOptions(lang);
  }

  findParentsByCategory(lang?: string) {
    return this.blogRepository.findParentsByCategory(lang);
  }
}
