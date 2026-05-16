import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { HeroBannerEntity } from '../entities/hero-banner.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { HeroBanner } from '../../../../domain/hero-banner';
import { HeroBannerRepository } from '../../hero-banner.repository';
import { HeroBannerMapper } from '../mappers/hero-banner.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import {
  FilterHeroBannerDto,
  SortHeroBannerDto,
} from '../../../../dto/find-all-hero-banners.dto';

@Injectable()
export class HeroBannerRelationalRepository implements HeroBannerRepository {
  constructor(
    @InjectRepository(HeroBannerEntity)
    private readonly heroBannerRepository: Repository<HeroBannerEntity>,
  ) {}

  async create(data: HeroBanner): Promise<HeroBanner> {
    const persistenceModel = HeroBannerMapper.toPersistence(data);
    const newEntity = await this.heroBannerRepository.save(
      this.heroBannerRepository.create(persistenceModel),
    );
    return HeroBannerMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
    lang,
  }: {
    filterOptions?: FilterHeroBannerDto | null;
    sortOptions?: SortHeroBannerDto[] | null;
    paginationOptions: IPaginationOptions;
    lang?: string;
  }): Promise<[HeroBanner[], number]> {
    const qb = this.heroBannerRepository.createQueryBuilder('heroBanner');

    if (lang) {
      qb.andWhere('heroBanner.language = :lang', { lang });
    }

    if (filterOptions?.search) {
      qb.andWhere(
        '(heroBanner.title ILIKE :search OR heroBanner.description ILIKE :search)',
        { search: `%${filterOptions.search}%` },
      );
    }

    if (sortOptions?.length) {
      sortOptions.forEach((sort) => {
        qb.addOrderBy(
          `heroBanner.${sort.orderBy}`,
          sort.order as 'ASC' | 'DESC',
        );
      });
    }

    qb.skip((paginationOptions.page - 1) * paginationOptions.limit);
    qb.take(paginationOptions.limit);

    const [entities, count] = await qb.getManyAndCount();

    return [entities.map((entity) => HeroBannerMapper.toDomain(entity)), count];
  }

  async findById(id: HeroBanner['id']): Promise<NullableType<HeroBanner>> {
    const entity = await this.heroBannerRepository.findOne({
      where: { id },
    });

    return entity ? HeroBannerMapper.toDomain(entity) : null;
  }

  async findByIds(ids: HeroBanner['id'][]): Promise<HeroBanner[]> {
    const entities = await this.heroBannerRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => HeroBannerMapper.toDomain(entity));
  }

  async update(
    id: HeroBanner['id'],
    payload: Partial<HeroBanner>,
  ): Promise<HeroBanner> {
    const entity = await this.heroBannerRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.heroBannerRepository.save(
      this.heroBannerRepository.create(
        HeroBannerMapper.toPersistence({
          ...HeroBannerMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return HeroBannerMapper.toDomain(updatedEntity);
  }

  async remove(id: HeroBanner['id']): Promise<void> {
    await this.heroBannerRepository.delete(id);
  }
}
