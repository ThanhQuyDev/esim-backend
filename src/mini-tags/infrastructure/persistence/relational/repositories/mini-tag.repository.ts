import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MiniTagEntity } from '../entities/mini-tag.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { MiniTag } from '../../../../domain/mini-tag';
import { MiniTagRepository } from '../../mini-tag.repository';
import { MiniTagMapper } from '../mappers/mini-tag.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class MiniTagRelationalRepository implements MiniTagRepository {
  constructor(
    @InjectRepository(MiniTagEntity)
    private readonly miniTagRepository: Repository<MiniTagEntity>,
  ) {}

  async create(data: MiniTag): Promise<MiniTag> {
    const persistenceModel = MiniTagMapper.toPersistence(data);
    const newEntity = await this.miniTagRepository.save(
      this.miniTagRepository.create(persistenceModel),
    );
    return MiniTagMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<MiniTag[]> {
    const entities = await this.miniTagRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      order: { createdAt: 'DESC' },
    });

    return entities.map((entity) => MiniTagMapper.toDomain(entity));
  }

  async findById(id: MiniTag['id']): Promise<NullableType<MiniTag>> {
    const entity = await this.miniTagRepository.findOne({
      where: { id },
    });

    return entity ? MiniTagMapper.toDomain(entity) : null;
  }

  async findByIds(ids: MiniTag['id'][]): Promise<MiniTag[]> {
    const entities = await this.miniTagRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => MiniTagMapper.toDomain(entity));
  }

  async update(id: MiniTag['id'], payload: Partial<MiniTag>): Promise<MiniTag> {
    const entity = await this.miniTagRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.miniTagRepository.save(
      this.miniTagRepository.create(
        MiniTagMapper.toPersistence({
          ...MiniTagMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return MiniTagMapper.toDomain(updatedEntity);
  }

  async remove(id: MiniTag['id']): Promise<void> {
    await this.miniTagRepository.delete(id);
  }
}
