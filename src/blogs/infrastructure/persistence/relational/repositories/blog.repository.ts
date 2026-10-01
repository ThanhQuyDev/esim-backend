import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, In } from 'typeorm';
import { BlogEntity } from '../entities/blog.entity';
import { MiniTagEntity } from '../../../../../mini-tags/infrastructure/persistence/relational/entities/mini-tag.entity';
import { PlanEntity } from '../../../../../plans/infrastructure/persistence/relational/entities/plan.entity';
import { FaqEntity } from '../../../../../faqs/infrastructure/persistence/relational/entities/faq.entity';
import { AuthorProfileEntity } from '../../../../../authors/infrastructure/persistence/relational/entities/author-profile.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Blog } from '../../../../domain/blog';
import { FilterBlogDto, SortBlogDto } from '../../../../dto/find-all-blogs.dto';
import { BlogRepository, LegacyBlogAuthor } from '../../blog.repository';
import { BlogMapper } from '../mappers/blog.mapper';
import { PlanMapper } from '../../../../../plans/infrastructure/persistence/relational/mappers/plan.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { parsePlanOrder, sortByPlanOrder } from '../../../../blog-plan-order';
import { toAuthorSlug } from '../../../../../authors/author-slug';

@Injectable()
export class BlogRelationalRepository implements BlogRepository {
  constructor(
    @InjectRepository(BlogEntity)
    private readonly blogRepository: Repository<BlogEntity>,
    @InjectRepository(MiniTagEntity)
    private readonly miniTagRepository: Repository<MiniTagEntity>,
    @InjectRepository(PlanEntity)
    private readonly planRepository: Repository<PlanEntity>,
    @InjectRepository(FaqEntity)
    private readonly faqRepository: Repository<FaqEntity>,
    @InjectRepository(AuthorProfileEntity)
    private readonly authorProfileRepository: Repository<AuthorProfileEntity>,
  ) {}

  async create(data: Blog): Promise<Blog> {
    const persistenceModel = BlogMapper.toPersistence(data);
    const authorProfileId = data.authorProfile?.id ?? data.authorProfileId;
    if (authorProfileId) {
      persistenceModel.authorProfile =
        (await this.authorProfileRepository.findOneBy({
          id: authorProfileId,
        })) ?? null;
    }
    if (data.miniTag?.id) {
      persistenceModel.miniTag =
        (await this.miniTagRepository.findOneBy({ id: data.miniTag.id })) ??
        null;
    }
    // Codes are the durable link (#047); the join table is rewritten from them so
    // everything that still joins on `blog_plans` keeps working.
    if (data.planCodes?.length) {
      persistenceModel.plans = await this.findPlansByCodes(data.planCodes);
    } else if (data.plans?.length) {
      persistenceModel.plans = await this.planRepository.findBy({
        id: In(data.plans.map((p) => p.id)),
      });
    }
    if (data.faqs?.length) {
      persistenceModel.faqs = await this.faqRepository.findBy({
        id: In(data.faqs.map((f) => f.id)),
      });
    }
    const newEntity = await this.blogRepository.save(
      this.blogRepository.create(persistenceModel),
    );
    return BlogMapper.toDomain(newEntity);
  }

  /** Plans for a list of slugs / supplier package codes, in the order given. */
  private async findPlansByCodes(codes: string[]): Promise<PlanEntity[]> {
    const wanted = codes.map((code) => code.trim()).filter(Boolean);
    if (!wanted.length) return [];

    const plans = await this.planRepository
      .createQueryBuilder('plan')
      .where('plan.slug IN (:...wanted)', { wanted })
      .orWhere('plan."providerPlanId" IN (:...wanted)', { wanted })
      .getMany();

    const byCode = new Map<string, PlanEntity>();
    for (const plan of plans) {
      for (const key of [plan.slug, plan.providerPlanId]) {
        if (!key) continue;
        const current = byCode.get(key);
        // Same tie-break as `resolvePlansFromCodes`: active first, then lowest id.
        if (
          !current ||
          (plan.isActive !== current.isActive
            ? plan.isActive
            : plan.id < current.id)
        ) {
          byCode.set(key, plan);
        }
      }
    }

    return wanted
      .map((code) => byCode.get(code))
      .filter((plan): plan is PlanEntity => !!plan);
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
  }): Promise<[Blog[], number]> {
    const qb = this.blogRepository
      .createQueryBuilder('blog')
      .leftJoin('blog.miniTag', 'miniTag')
      .leftJoinAndSelect('blog.authorProfile', 'authorProfile')
      // List view never needs the heavy `content` column — select only the
      // fields BlogListItem exposes (plus the miniTag join) to keep the
      // payload small and avoid reading large rows from the DB.
      .select([
        'blog.id',
        'blog.language',
        'blog.title',
        'blog.slug',
        'blog.excerpt',
        'blog.coverImage',
        'blog.author',
        'blog.authorAvatar',
        'blog.authorProfileId',
        'authorProfile',
        'blog.category',
        'blog.parent',
        'blog.planOrder',
        'blog.planCodes',
        'blog.timeRead',
        'blog.isPublished',
        'blog.publishedAt',
        'blog.faqEnabled',
        'blog.isPopular',
        'blog.createdAt',
        'blog.updatedAt',
        'miniTag',
      ]);

    if (lang) {
      qb.andWhere('blog.language = :lang', { lang });
    }

    if (filterOptions?.isPublished !== undefined) {
      qb.andWhere('blog.isPublished = :isPublished', {
        isPublished: filterOptions.isPublished,
      });
    }

    if (filterOptions?.isPopular !== undefined) {
      qb.andWhere('blog.isPopular = :isPopular', {
        isPopular: filterOptions.isPopular,
      });
    }

    if (filterOptions?.authorSlug) {
      const legacyNames = filterOptions.legacyAuthorNames ?? [];
      qb.andWhere(
        new Brackets((sub) => {
          sub.where('authorProfile.slug = :authorSlug', {
            authorSlug: filterOptions.authorSlug,
          });
          // Articles written before author profiles existed carry only a
          // byline; they belong to this author when the byline's slug matches.
          if (legacyNames.length) {
            sub.orWhere(
              'blog.authorProfileId IS NULL AND blog.author IN (:...legacyNames)',
              { legacyNames },
            );
          }
        }),
      );
    }

    if (filterOptions?.category) {
      qb.andWhere('blog.category = :category', {
        category: filterOptions.category,
      });
    }

    if (filterOptions?.parent) {
      qb.andWhere('blog.parent = :parent', {
        parent: filterOptions.parent,
      });
    }

    if (filterOptions?.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('blog.title ILIKE :search', {
              search: `%${filterOptions.search}%`,
            })
            .orWhere('blog.category ILIKE :search', {
              search: `%${filterOptions.search}%`,
            })
            .orWhere('blog.parent ILIKE :search', {
              search: `%${filterOptions.search}%`,
            });
        }),
      );
    }

    if (sortOptions?.length) {
      sortOptions.forEach((sort) => {
        qb.addOrderBy(`blog.${sort.orderBy}`, sort.order as 'ASC' | 'DESC');
      });
    } else {
      qb.orderBy('blog.createdAt', 'DESC');
      qb.addOrderBy('blog.id', 'ASC');
    }

    qb.skip((paginationOptions.page - 1) * paginationOptions.limit);
    qb.take(paginationOptions.limit);

    const [entities, count] = await qb.getManyAndCount();

    const blogIds = entities.map((e) => e.id);
    const planIdsMap = new Map<string, number[]>();
    const faqIdsMap = new Map<string, string[]>();

    if (blogIds.length) {
      const rawPlanIds = await this.blogRepository
        .createQueryBuilder('blog')
        .leftJoin('blog.plans', 'plan')
        .select(['blog.id', 'plan.id'])
        .where('blog.id IN (:...blogIds)', { blogIds })
        .getRawMany();

      for (const row of rawPlanIds) {
        const blogId = row.blog_id;
        const planId = row.plan_id;
        if (planId) {
          if (!planIdsMap.has(blogId)) {
            planIdsMap.set(blogId, []);
          }
          planIdsMap.get(blogId)!.push(Number(planId));
        }
      }

      const rawFaqIds = await this.blogRepository
        .createQueryBuilder('blog')
        .leftJoin('blog.faqs', 'faq')
        .select(['blog.id', 'faq.id'])
        .where('blog.id IN (:...blogIds)', { blogIds })
        .getRawMany();

      for (const row of rawFaqIds) {
        const blogId = row.blog_id;
        const faqId = row.faq_id;
        if (faqId) {
          if (!faqIdsMap.has(blogId)) {
            faqIdsMap.set(blogId, []);
          }
          faqIdsMap.get(blogId)!.push(String(faqId));
        }
      }
    }

    const blogs = entities.map((entity) => {
      const blog = BlogMapper.toDomain(entity);
      // Same typed order as the post's plans (#057).
      blog.planIds = (
        sortByPlanOrder(
          (planIdsMap.get(entity.id) ?? []).map((id) => ({ id })),
          parsePlanOrder(entity.planOrder),
        ) ?? []
      ).map(({ id }) => id);
      blog.faqIds = faqIdsMap.get(entity.id) ?? [];
      return blog;
    });

    // Codes win over the join table wherever they are set (#047), so the list's
    // `planIds` agree with what the article page will actually show.
    await this.resolvePlansFromCodes(blogs);

    return [blogs, count];
  }

  async findLegacyAuthors(): Promise<LegacyBlogAuthor[]> {
    const rows = await this.blogRepository
      .createQueryBuilder('blog')
      .select('blog.author', 'name')
      .addSelect('MAX(blog.authorAvatar)', 'avatar')
      .addSelect('COUNT(*)', 'blogs')
      .where('blog.authorProfileId IS NULL')
      .andWhere('blog.author IS NOT NULL')
      .andWhere('blog.isPublished = true')
      .groupBy('blog.author')
      .getRawMany<{ name: string; avatar: string | null; blogs: string }>();

    return rows.map((row) => ({
      name: row.name,
      avatar: row.avatar ?? null,
      blogs: Number(row.blogs) || 0,
    }));
  }

  /**
   * Replace each article's `plans` with the ones its `planCodes` resolve to
   * (#047).
   *
   * This is what makes the link survive a catalogue re-import: `blog_plans` is
   * keyed by plan id, so recreated plan rows break it, while a slug or a supplier
   * package code comes back unchanged. An article with no codes — one saved
   * before this existed — keeps whatever the join table gave it.
   *
   * One query for the whole batch, never one per article.
   */
  private async resolvePlansFromCodes(blogs: Blog[]): Promise<void> {
    const codes = [
      ...new Set(
        blogs.flatMap((blog) => blog.planCodes ?? []).filter((code) => !!code),
      ),
    ];
    if (!codes.length) return;

    const plans = await this.planRepository
      .createQueryBuilder('plan')
      .where('plan.slug IN (:...codes)', { codes })
      .orWhere('plan."providerPlanId" IN (:...codes)', { codes })
      .getMany();

    // A slug is unique, so it always names exactly one plan. `providerPlanId` has
    // no unique index and can repeat across suppliers, so an active plan wins and
    // the lowest id breaks a remaining tie — arbitrary, but stable, which beats
    // the list changing between two page loads.
    const byCode = new Map<string, PlanEntity>();
    const better = (candidate: PlanEntity, current: PlanEntity) =>
      candidate.isActive !== current.isActive
        ? candidate.isActive
        : candidate.id < current.id;

    for (const plan of plans) {
      for (const key of [plan.slug, plan.providerPlanId]) {
        if (!key) continue;
        const current = byCode.get(key);
        if (!current || better(plan, current)) byCode.set(key, plan);
      }
    }

    for (const blog of blogs) {
      const wanted = blog.planCodes;
      if (!wanted?.length) continue;

      // Order follows the codes, so the editor's order is what the page shows.
      // A code that resolves to nothing is dropped rather than rendered empty —
      // the code itself stays stored, so it starts working again if the plan
      // comes back.
      const resolved = wanted
        .map((code) => byCode.get(code))
        .filter((plan): plan is PlanEntity => !!plan);

      blog.plans = resolved.map((plan) => PlanMapper.toDomain(plan));
      blog.planIds = resolved.map((plan) => plan.id);
    }
  }

  async findById(id: Blog['id']): Promise<NullableType<Blog>> {
    const entity = await this.blogRepository.findOne({
      where: { id },
      relations: {
        miniTag: true,
        plans: true,
        faqs: true,
        authorProfile: true,
      },
    });

    if (!entity) return null;
    const blog = BlogMapper.toDomain(entity);
    await this.resolvePlansFromCodes([blog]);
    return blog;
  }

  async findBySlug(slug: string): Promise<NullableType<Blog>> {
    const normalized = slug.startsWith('/') ? slug : `/${slug}`;
    const entity = await this.blogRepository.findOne({
      where: { slug: normalized, isPublished: true },
      relations: {
        miniTag: true,
        plans: true,
        faqs: true,
        authorProfile: true,
      },
    });

    if (!entity) return null;
    const blog = BlogMapper.toDomain(entity);
    await this.resolvePlansFromCodes([blog]);
    return blog;
  }

  async findByIds(ids: Blog['id'][]): Promise<Blog[]> {
    const entities = await this.blogRepository.find({
      where: { id: In(ids) },
      relations: {
        miniTag: true,
        plans: true,
        faqs: true,
        authorProfile: true,
      },
    });

    const blogs = entities.map((entity) => BlogMapper.toDomain(entity));
    await this.resolvePlansFromCodes(blogs);
    return blogs;
  }

  async update(id: Blog['id'], payload: Partial<Blog>): Promise<Blog> {
    const entity = await this.blogRepository.findOne({
      where: { id },
      relations: {
        miniTag: true,
        plans: true,
        faqs: true,
        authorProfile: true,
      },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const merged = BlogMapper.toPersistence({
      ...BlogMapper.toDomain(entity),
      ...payload,
    });

    if (payload.miniTag !== undefined) {
      merged.miniTag = payload.miniTag?.id
        ? ((await this.miniTagRepository.findOneBy({
            id: payload.miniTag.id,
          })) ?? null)
        : null;
    }

    // Codes win when they were sent, and rewrite the join table (#047). An update
    // that sends neither leaves both alone.
    if (payload.planCodes !== undefined) {
      merged.plans = await this.findPlansByCodes(payload.planCodes ?? []);
      merged.planCodes = payload.planCodes ?? [];
    } else if (payload.plans !== undefined) {
      merged.plans = payload.plans?.length
        ? await this.planRepository.findBy({
            id: In(payload.plans.map((p) => p.id)),
          })
        : [];
    }

    if (payload.faqs !== undefined) {
      merged.faqs = payload.faqs?.length
        ? await this.faqRepository.findBy({
            id: In(payload.faqs.map((f) => f.id)),
          })
        : [];
    }

    const updatedEntity = await this.blogRepository.save(
      this.blogRepository.create(merged),
    );

    return BlogMapper.toDomain(updatedEntity);
  }

  async remove(id: Blog['id']): Promise<void> {
    await this.blogRepository.delete(id);
  }

  async findCategories(lang?: string): Promise<string[]> {
    const qb = this.blogRepository
      .createQueryBuilder('blog')
      .select('DISTINCT blog.category', 'category')
      .where('blog.category IS NOT NULL');

    if (lang) {
      qb.andWhere('blog.language = :lang', { lang });
    }

    const results = await qb.getRawMany();

    return results.map((r) => r.category);
  }

  /**
   * The authors that actually have articles, for the CMS filter's select box
   * (#046) — derived from the articles rather than from the user table, so the
   * list never offers an author with nothing to show.
   *
   * `slug` is what the filter matches on. Articles written before author
   * profiles existed carry only a byline, so their slug is derived from the name
   * the same way `findAuthorBySlug` does it; that is also what makes them
   * selectable at all.
   */
  async findAuthorOptions(
    lang?: string,
  ): Promise<{ slug: string; name: string }[]> {
    const qb = this.blogRepository
      .createQueryBuilder('blog')
      .leftJoin('blog.authorProfile', 'authorProfile')
      .select([
        'authorProfile.slug AS "profileSlug"',
        'authorProfile.name AS "profileName"',
        'blog.author AS "byline"',
      ])
      .where('authorProfile.slug IS NOT NULL OR blog.author IS NOT NULL');

    if (lang) {
      qb.andWhere('blog.language = :lang', { lang });
    }

    const rows = await qb
      .groupBy('authorProfile.slug')
      .addGroupBy('authorProfile.name')
      .addGroupBy('blog.author')
      .getRawMany<{
        profileSlug: string | null;
        profileName: string | null;
        byline: string | null;
      }>();

    // A profile and a legacy byline can name the same person; keyed by slug so
    // they collapse into one option, with the profile's name preferred.
    const bySlug = new Map<string, string>();
    for (const row of rows) {
      const name = (row.profileName ?? row.byline ?? '').trim();
      if (!name) continue;
      const slug = row.profileSlug ?? toAuthorSlug(name);
      if (!slug) continue;
      if (row.profileSlug || !bySlug.has(slug)) bySlug.set(slug, name);
    }

    return [...bySlug.entries()]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }

  async findParentsByCategory(
    lang?: string,
  ): Promise<Record<string, string[]>> {
    const qb = this.blogRepository
      .createQueryBuilder('blog')
      .select(['blog.category', 'blog.parent'])
      .where('blog.category IS NOT NULL')
      .andWhere('blog.parent IS NOT NULL');

    if (lang) {
      qb.andWhere('blog.language = :lang', { lang });
    }

    const results = await qb
      .groupBy('blog.category')
      .addGroupBy('blog.parent')
      .getRawMany();

    const grouped: Record<string, string[]> = {};
    for (const r of results) {
      const cat = r.blog_category;
      const parent = r.blog_parent;
      if (!grouped[cat]) grouped[cat] = [];
      if (!grouped[cat].includes(parent)) grouped[cat].push(parent);
    }
    return grouped;
  }
}
