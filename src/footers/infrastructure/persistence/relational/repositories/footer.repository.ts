import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { FooterEntity } from '../entities/footer.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Footer } from '../../../../domain/footer';
import { FooterRepository } from '../../footer.repository';
import { FooterMapper } from '../mappers/footer.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class FooterRelationalRepository implements FooterRepository {
  constructor(
    @InjectRepository(FooterEntity)
    private readonly footerRepository: Repository<FooterEntity>,
  ) {}

  async create(data: Footer): Promise<Footer> {
    const persistenceModel = FooterMapper.toPersistence(data);
    const newEntity = await this.footerRepository.save(
      this.footerRepository.create(persistenceModel),
    );
    return FooterMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<Footer[]> {
    const entities = await this.footerRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return entities.map((entity) => FooterMapper.toDomain(entity));
  }

  async findById(id: Footer['id']): Promise<NullableType<Footer>> {
    const entity = await this.footerRepository.findOne({
      where: { id },
    });

    return entity ? FooterMapper.toDomain(entity) : null;
  }

  async findByIds(ids: Footer['id'][]): Promise<Footer[]> {
    const entities = await this.footerRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => FooterMapper.toDomain(entity));
  }

  async update(id: Footer['id'], payload: Partial<Footer>): Promise<Footer> {
    const entity = await this.footerRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.footerRepository.save(
      this.footerRepository.create(
        FooterMapper.toPersistence({
          ...FooterMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return FooterMapper.toDomain(updatedEntity);
  }

  async remove(id: Footer['id']): Promise<void> {
    await this.footerRepository.delete(id);
  }
}
