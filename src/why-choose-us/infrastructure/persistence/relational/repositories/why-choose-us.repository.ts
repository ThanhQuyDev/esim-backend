import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { WhyChooseUsEntity } from '../entities/why-choose-us.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { WhyChooseUs } from '../../../../domain/why-choose-us';
import { WhyChooseUsRepository } from '../../why-choose-us.repository';
import { WhyChooseUsMapper } from '../mappers/why-choose-us.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import {
  FilterWhyChooseUsDto,
  SortWhyChooseUsDto,
} from '../../../../dto/find-all-why-choose-us.dto';

/** English page names an admin may type, in the stored types' wording. */
const TYPE_ALIASES: Record<string, string> = {
  home: 'trang chu',
  homepage: 'trang chu',
  country: 'quoc gia',
  countries: 'quoc gia',
  region: 'khu vuc',
  regions: 'khu vuc',
};

/**
 * The search term to match against a row's page type (`trang_chu`, …). Types
 * are stored without accents, so the CMS labels typed as shown ("Quốc gia",
 * "Trang chủ") never matched (#005): accents are folded away, `_` and spaces
 * are treated alike, and the English page names map to the stored ones.
 */
export function typeSearchTerm(search: string): string {
  const folded = search
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .trim();
  return TYPE_ALIASES[folded] ?? folded;
}

@Injectable()
export class WhyChooseUsRelationalRepository implements WhyChooseUsRepository {
  constructor(
    @InjectRepository(WhyChooseUsEntity)
    private readonly whyChooseUsRepository: Repository<WhyChooseUsEntity>,
  ) {}

  async create(data: WhyChooseUs): Promise<WhyChooseUs> {
    const persistenceModel = WhyChooseUsMapper.toPersistence(data);
    const newEntity = await this.whyChooseUsRepository.save(
      this.whyChooseUsRepository.create(persistenceModel),
    );
    return WhyChooseUsMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
    lang,
  }: {
    filterOptions?: FilterWhyChooseUsDto | null;
    sortOptions?: SortWhyChooseUsDto[] | null;
    paginationOptions: IPaginationOptions;
    lang?: string;
  }): Promise<[WhyChooseUs[], number]> {
    const qb = this.whyChooseUsRepository.createQueryBuilder('whyChooseUs');

    if (lang) {
      qb.andWhere('whyChooseUs.language = :lang', { lang });
    }

    const search = filterOptions?.search?.trim();
    if (search) {
      // Match the page type as well as title/description, so an admin can
      // narrow to a single page by TYPING it ("Quốc gia") instead of only
      // picking it from the dropdown — same idea as searching FAQ/SEO rows by
      // their url. Title/description keep the term as typed (they hold
      // Vietnamese text); the type is matched on its folded form.
      qb.andWhere(
        `(whyChooseUs.title ILIKE :search
          OR whyChooseUs.description ILIKE :search
          OR REPLACE(whyChooseUs.type, '_', ' ') ILIKE :typeSearch)`,
        { search: `%${search}%`, typeSearch: `%${typeSearchTerm(search)}%` },
      );
    }

    // One or more page types, comma-separated ("trang_chu,quoc_gia"): a row
    // matches when its own comma-separated type list holds ANY of them, so the
    // CMS can show several pages' reasons at once (#005). A row can itself
    // belong to several pages.
    const types = (filterOptions?.type ?? '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (types.length > 0) {
      qb.andWhere(
        `(${types
          .map(
            (_, i) =>
              `(',' || LOWER(REPLACE(whyChooseUs.type, ' ', '')) || ',') LIKE :typePattern${i}`,
          )
          .join(' OR ')})`,
        Object.fromEntries(
          types.map((t, i) => [`typePattern${i}`, `%,${t},%`]),
        ),
      );
    }

    if (sortOptions?.length) {
      sortOptions.forEach((sort) => {
        qb.addOrderBy(
          `whyChooseUs.${sort.orderBy}`,
          sort.order as 'ASC' | 'DESC',
        );
      });
    } else {
      qb.orderBy('whyChooseUs.createdAt', 'DESC');
      qb.addOrderBy('whyChooseUs.id', 'ASC');
    }

    qb.skip((paginationOptions.page - 1) * paginationOptions.limit);
    qb.take(paginationOptions.limit);

    const [entities, count] = await qb.getManyAndCount();

    return [
      entities.map((entity) => WhyChooseUsMapper.toDomain(entity)),
      count,
    ];
  }

  async findById(id: WhyChooseUs['id']): Promise<NullableType<WhyChooseUs>> {
    const entity = await this.whyChooseUsRepository.findOne({
      where: { id },
    });

    return entity ? WhyChooseUsMapper.toDomain(entity) : null;
  }

  async findByIds(ids: WhyChooseUs['id'][]): Promise<WhyChooseUs[]> {
    const entities = await this.whyChooseUsRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => WhyChooseUsMapper.toDomain(entity));
  }

  async update(
    id: WhyChooseUs['id'],
    payload: Partial<WhyChooseUs>,
  ): Promise<WhyChooseUs> {
    const entity = await this.whyChooseUsRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.whyChooseUsRepository.save(
      this.whyChooseUsRepository.create(
        WhyChooseUsMapper.toPersistence({
          ...WhyChooseUsMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return WhyChooseUsMapper.toDomain(updatedEntity);
  }

  async remove(id: WhyChooseUs['id']): Promise<void> {
    await this.whyChooseUsRepository.delete(id);
  }
}
