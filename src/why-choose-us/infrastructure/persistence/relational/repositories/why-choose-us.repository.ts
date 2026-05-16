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
  }: {
    filterOptions?: FilterWhyChooseUsDto | null;
    sortOptions?: SortWhyChooseUsDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[WhyChooseUs[], number]> {
    const qb = this.whyChooseUsRepository.createQueryBuilder('whyChooseUs');

    if (filterOptions?.search) {
      qb.andWhere(
        '(whyChooseUs.title ILIKE :search OR whyChooseUs.description ILIKE :search)',
        { search: `%${filterOptions.search}%` },
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
