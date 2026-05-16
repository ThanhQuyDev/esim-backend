import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { HelpCenterEntity } from '../entities/help-center.entity';
import { HelpCenter } from '../../../../domain/help-center';
import { HelpCenterRepository } from '../../help-center.repository';
import { HelpCenterMapper } from '../mappers/help-center.mapper';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import {
  FilterHelpCenterDto,
  SortHelpCenterDto,
} from '../../../../dto/find-all-help-center.dto';

@Injectable()
export class HelpCenterRelationalRepository implements HelpCenterRepository {
  constructor(
    @InjectRepository(HelpCenterEntity)
    private readonly repo: Repository<HelpCenterEntity>,
  ) {}

  async create(
    data: Omit<HelpCenter, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<HelpCenter> {
    const newEntity = await this.repo.save(
      this.repo.create(HelpCenterMapper.toPersistence(data as HelpCenter)),
    );
    return HelpCenterMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterHelpCenterDto | null;
    sortOptions?: SortHelpCenterDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[HelpCenter[], number]> {
    const qb = this.repo.createQueryBuilder('helpCenter');

    if (filterOptions?.category) {
      qb.andWhere('helpCenter.category = :category', {
        category: filterOptions.category,
      });
    }
    if (filterOptions?.parent) {
      qb.andWhere('helpCenter.parent = :parent', {
        parent: filterOptions.parent,
      });
    }
    if (filterOptions?.search) {
      qb.andWhere('helpCenter.title ILIKE :search', {
        search: `%${filterOptions.search}%`,
      });
    }

    if (sortOptions?.length) {
      sortOptions.forEach((sort) => {
        qb.addOrderBy(
          `helpCenter.${sort.orderBy}`,
          sort.order as 'ASC' | 'DESC',
        );
      });
    } else {
      qb.orderBy('helpCenter.order', 'ASC');
    }

    qb.skip((paginationOptions.page - 1) * paginationOptions.limit);
    qb.take(paginationOptions.limit);

    const [entities, count] = await qb.getManyAndCount();
    return [entities.map(HelpCenterMapper.toDomain), count];
  }

  async findById(id: HelpCenter['id']): Promise<NullableType<HelpCenter>> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? HelpCenterMapper.toDomain(entity) : null;
  }

  async findByIds(ids: HelpCenter['id'][]): Promise<HelpCenter[]> {
    const entities = await this.repo.find({ where: { id: In(ids) } });
    return entities.map(HelpCenterMapper.toDomain);
  }

  async update(
    id: HelpCenter['id'],
    payload: Partial<HelpCenter>,
  ): Promise<HelpCenter> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new Error('Record not found');
    const updated = await this.repo.save(
      this.repo.create(
        HelpCenterMapper.toPersistence({
          ...HelpCenterMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );
    return HelpCenterMapper.toDomain(updated);
  }

  async remove(id: HelpCenter['id']): Promise<void> {
    await this.repo.delete(id);
  }
}
