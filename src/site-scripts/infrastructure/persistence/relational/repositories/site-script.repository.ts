import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteScriptEntity } from '../entities/site-script.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { SiteScript } from '../../../../domain/site-script';
import { SiteScriptRepository } from '../../site-script.repository';
import { SiteScriptMapper } from '../mappers/site-script.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class SiteScriptRelationalRepository implements SiteScriptRepository {
  constructor(
    @InjectRepository(SiteScriptEntity)
    private readonly siteScriptRepository: Repository<SiteScriptEntity>,
  ) {}

  async create(data: SiteScript): Promise<SiteScript> {
    const persistenceModel = SiteScriptMapper.toPersistence(data);
    const newEntity = await this.siteScriptRepository.save(
      this.siteScriptRepository.create(persistenceModel),
    );
    return SiteScriptMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<[SiteScript[], number]> {
    const [entities, count] = await this.siteScriptRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      order: { placement: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' },
    });

    return [entities.map((entity) => SiteScriptMapper.toDomain(entity)), count];
  }

  async findActive(): Promise<SiteScript[]> {
    const entities = await this.siteScriptRepository.find({
      where: { isActive: true },
      // Order within a placement matters: a gtag config call has to run after the
      // loader it configures, so the admin's ordering is preserved exactly.
      order: { placement: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' },
    });

    return entities.map((entity) => SiteScriptMapper.toDomain(entity));
  }

  async findById(id: SiteScript['id']): Promise<NullableType<SiteScript>> {
    const entity = await this.siteScriptRepository.findOne({ where: { id } });
    return entity ? SiteScriptMapper.toDomain(entity) : null;
  }

  async update(
    id: SiteScript['id'],
    payload: Partial<SiteScript>,
  ): Promise<SiteScript> {
    const entity = await this.siteScriptRepository.findOne({ where: { id } });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.siteScriptRepository.save(
      this.siteScriptRepository.create(
        SiteScriptMapper.toPersistence({
          ...SiteScriptMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return SiteScriptMapper.toDomain(updatedEntity);
  }

  async remove(id: SiteScript['id']): Promise<void> {
    await this.siteScriptRepository.delete(id);
  }
}
