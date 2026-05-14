import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { HelpCenterEntity } from '../entities/help-center.entity';
import {
  HelpCenter,
  HelpCenterCategory,
  HelpCenterParent,
} from '../../../../domain/help-center';
import { HelpCenterRepository } from '../../help-center.repository';
import { HelpCenterMapper } from '../mappers/help-center.mapper';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

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
    paginationOptions,
    category,
    parent,
  }: {
    paginationOptions: IPaginationOptions;
    category?: HelpCenterCategory;
    parent?: HelpCenterParent;
  }): Promise<[HelpCenter[], number]> {
    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (parent) where.parent = parent;

    const [entities, count] = await this.repo.findAndCount({
      where,
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      order: { order: 'ASC' },
    });
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
