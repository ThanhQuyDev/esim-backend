import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ILike } from 'typeorm';
import { FaqEntity } from '../entities/faq.entity';
import { BlogEntity } from '../../../../../blogs/infrastructure/persistence/relational/entities/blog.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Faq } from '../../../../domain/faq';
import { FaqRepository } from '../../faq.repository';
import { FaqMapper } from '../mappers/faq.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { FilterFaqDto } from '../../../../dto/find-all-faqs.dto';

@Injectable()
export class FaqRelationalRepository implements FaqRepository {
  constructor(
    @InjectRepository(FaqEntity)
    private readonly faqRepository: Repository<FaqEntity>,
    @InjectRepository(BlogEntity)
    private readonly blogRepository: Repository<BlogEntity>,
  ) {}

  async create(data: Faq): Promise<Faq> {
    const persistenceModel = FaqMapper.toPersistence(data);
    const newEntity = await this.faqRepository.save(
      this.faqRepository.create(persistenceModel),
    );
    return FaqMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
    filterOptions,
  }: {
    paginationOptions: IPaginationOptions;
    filterOptions?: FilterFaqDto | null;
  }): Promise<[Faq[], number]> {
    const where: any = {};

    if (filterOptions?.search) {
      where.question = ILike(`%${filterOptions.search}%`);
    }

    const [entities, count] = await this.faqRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      where,
      order: { createdAt: 'DESC' },
    });

    return [entities.map((entity) => FaqMapper.toDomain(entity)), count];
  }

  async findById(id: Faq['id']): Promise<NullableType<Faq>> {
    const entity = await this.faqRepository.findOne({
      where: { id },
    });

    return entity ? FaqMapper.toDomain(entity) : null;
  }

  async findByIds(ids: Faq['id'][]): Promise<Faq[]> {
    const entities = await this.faqRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => FaqMapper.toDomain(entity));
  }

  async update(id: Faq['id'], payload: Partial<Faq>): Promise<Faq> {
    const entity = await this.faqRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.faqRepository.save(
      this.faqRepository.create(
        FaqMapper.toPersistence({
          ...FaqMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return FaqMapper.toDomain(updatedEntity);
  }

  async findByUrlOrBlogId(options: {
    url?: string;
    blogId?: string;
    language?: string;
    limit?: number;
  }): Promise<Faq[]> {
    const targetLimit = options.limit ?? 6;
    const collectedIds = new Set<string>();
    const results: FaqEntity[] = [];

    // 1. Find FAQs linked to the blog (via blog_faqs join table)
    if (options.blogId) {
      const blog = await this.blogRepository.findOne({
        where: { id: options.blogId },
        relations: { faqs: true },
      });
      if (blog?.faqs?.length) {
        for (const faq of blog.faqs) {
          if (!options.language || faq.language === options.language) {
            results.push(faq);
            collectedIds.add(faq.id);
          }
        }
      }
    }

    // 2. Find FAQs matching the exact url sent by the client.
    // No ancestor-path fallback: only FAQs attached to the exact slug match.
    if (options.url && results.length < targetLimit) {
      const urlFaqs = await this.faqRepository.find({
        where: {
          url: options.url,
          isActive: true,
          ...(options.language ? { language: options.language } : {}),
        },
        order: { sortOrder: 'ASC' },
      });

      for (const faq of urlFaqs) {
        if (!collectedIds.has(faq.id)) {
          results.push(faq);
          collectedIds.add(faq.id);
        }
        if (results.length >= targetLimit) break;
      }
    }

    return results.slice(0, targetLimit).map((e) => FaqMapper.toDomain(e));
  }

  async remove(id: Faq['id']): Promise<void> {
    await this.faqRepository.delete(id);
  }
}
