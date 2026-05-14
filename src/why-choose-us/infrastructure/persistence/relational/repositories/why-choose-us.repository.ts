import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { WhyChooseUsEntity } from '../entities/why-choose-us.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { WhyChooseUs } from '../../../../domain/why-choose-us';
import { WhyChooseUsRepository } from '../../why-choose-us.repository';
import { WhyChooseUsMapper } from '../mappers/why-choose-us.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

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
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<[WhyChooseUs[], number]> {
    const [entities, count] = await this.whyChooseUsRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      order: { createdAt: 'DESC' },
    });

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
