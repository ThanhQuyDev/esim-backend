import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { FooterEntity } from '../entities/footer.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Footer } from '../../../../domain/footer';
import { FooterRepository } from '../../footer.repository';
import { FooterMapper } from '../mappers/footer.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import {
  FilterFooterDto,
  SortFooterDto,
} from '../../../../dto/find-all-footers.dto';

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
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterFooterDto | null;
    sortOptions?: SortFooterDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[Footer[], number]> {
    const qb = this.footerRepository.createQueryBuilder('footer');

    if (filterOptions?.search) {
      qb.andWhere(
        '(footer.title ILIKE :search OR footer.titleVi ILIKE :search)',
        { search: `%${filterOptions.search}%` },
      );
    }

    if (sortOptions?.length) {
      sortOptions.forEach((sort) => {
        qb.addOrderBy(`footer.${sort.orderBy}`, sort.order as 'ASC' | 'DESC');
      });
    } else {
      qb.orderBy('footer.createdAt', 'DESC');
    }

    qb.skip((paginationOptions.page - 1) * paginationOptions.limit);
    qb.take(paginationOptions.limit);

    const [entities, count] = await qb.getManyAndCount();

    return [entities.map((entity) => FooterMapper.toDomain(entity)), count];
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
