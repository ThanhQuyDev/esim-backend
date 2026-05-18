import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { BlogEntity } from '../entities/blog.entity';
import { MiniTagEntity } from '../../../../../mini-tags/infrastructure/persistence/relational/entities/mini-tag.entity';
import { PlanEntity } from '../../../../../plans/infrastructure/persistence/relational/entities/plan.entity';
import { FaqEntity } from '../../../../../faqs/infrastructure/persistence/relational/entities/faq.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Blog } from '../../../../domain/blog';
import { FilterBlogDto, SortBlogDto } from '../../../../dto/find-all-blogs.dto';
import { BlogRepository } from '../../blog.repository';
import { BlogMapper } from '../mappers/blog.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

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
  ) {}

  async create(data: Blog): Promise<Blog> {
    const persistenceModel = BlogMapper.toPersistence(data);
    if (data.miniTag?.id) {
      persistenceModel.miniTag =
        (await this.miniTagRepository.findOneBy({ id: data.miniTag.id })) ??
        null;
    }
    if (data.plans?.length) {
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

  async findAllWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterBlogDto | null;
    sortOptions?: SortBlogDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[Blog[], number]> {
    const qb = this.blogRepository
      .createQueryBuilder('blog')
      .leftJoinAndSelect('blog.miniTag', 'miniTag');

    if (filterOptions?.category) {
      qb.andWhere('blog.category = :category', {
        category: filterOptions.category,
      });
    }

    if (filterOptions?.search) {
      qb.andWhere('blog.title ILIKE :search', {
        search: `%${filterOptions.search}%`,
      });
    }

    if (sortOptions?.length) {
      sortOptions.forEach((sort) => {
        qb.addOrderBy(`blog.${sort.orderBy}`, sort.order as 'ASC' | 'DESC');
      });
    } else {
      qb.orderBy('blog.createdAt', 'DESC');
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

    return [
      entities.map((entity) => {
        const blog = BlogMapper.toDomain(entity);
        blog.planIds = planIdsMap.get(entity.id) ?? [];
        blog.faqIds = faqIdsMap.get(entity.id) ?? [];
        return blog;
      }),
      count,
    ];
  }

  async findById(id: Blog['id']): Promise<NullableType<Blog>> {
    const entity = await this.blogRepository.findOne({
      where: { id },
      relations: { miniTag: true, plans: true, faqs: true },
    });

    return entity ? BlogMapper.toDomain(entity) : null;
  }

  async findBySlug(slug: string): Promise<NullableType<Blog>> {
    const normalized = slug.startsWith('/') ? slug : `/${slug}`;
    const entity = await this.blogRepository.findOne({
      where: { slug: normalized, isPublished: true },
      relations: { miniTag: true, plans: true, faqs: true },
    });

    return entity ? BlogMapper.toDomain(entity) : null;
  }

  async findByIds(ids: Blog['id'][]): Promise<Blog[]> {
    const entities = await this.blogRepository.find({
      where: { id: In(ids) },
      relations: { miniTag: true, plans: true, faqs: true },
    });

    return entities.map((entity) => BlogMapper.toDomain(entity));
  }

  async update(id: Blog['id'], payload: Partial<Blog>): Promise<Blog> {
    const entity = await this.blogRepository.findOne({
      where: { id },
      relations: { miniTag: true, plans: true, faqs: true },
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

    if (payload.plans !== undefined) {
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

  async findCategories(): Promise<string[]> {
    const results = await this.blogRepository
      .createQueryBuilder('blog')
      .select('DISTINCT blog.category', 'category')
      .where('blog.category IS NOT NULL')
      .getRawMany();

    return results.map((r) => r.category);
  }
}
