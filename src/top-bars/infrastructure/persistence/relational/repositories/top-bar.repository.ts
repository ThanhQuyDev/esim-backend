import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TopBarEntity } from '../entities/top-bar.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { TopBar } from '../../../../domain/top-bar';
import { TopBarRepository } from '../../top-bar.repository';
import { TopBarMapper } from '../mappers/top-bar.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class TopBarRelationalRepository implements TopBarRepository {
  constructor(
    @InjectRepository(TopBarEntity)
    private readonly topBarRepository: Repository<TopBarEntity>,
  ) {}

  async create(data: TopBar): Promise<TopBar> {
    const persistenceModel = TopBarMapper.toPersistence(data);
    const newEntity = await this.topBarRepository.save(
      this.topBarRepository.create(persistenceModel),
    );
    return TopBarMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
    lang,
  }: {
    paginationOptions: IPaginationOptions;
    lang?: string;
  }): Promise<[TopBar[], number]> {
    const where: Record<string, unknown> = {};
    if (lang) {
      where.language = lang;
    }

    const [entities, count] = await this.topBarRepository.findAndCount({
      where,
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return [entities.map((entity) => TopBarMapper.toDomain(entity)), count];
  }

  async findById(id: TopBar['id']): Promise<NullableType<TopBar>> {
    const entity = await this.topBarRepository.findOne({
      where: { id },
    });

    return entity ? TopBarMapper.toDomain(entity) : null;
  }

  async findByIds(ids: TopBar['id'][]): Promise<TopBar[]> {
    const entities = await this.topBarRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => TopBarMapper.toDomain(entity));
  }

  async update(id: TopBar['id'], payload: Partial<TopBar>): Promise<TopBar> {
    const entity = await this.topBarRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.topBarRepository.save(
      this.topBarRepository.create(
        TopBarMapper.toPersistence({
          ...TopBarMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return TopBarMapper.toDomain(updatedEntity);
  }

  async remove(id: TopBar['id']): Promise<void> {
    await this.topBarRepository.delete(id);
  }
}
