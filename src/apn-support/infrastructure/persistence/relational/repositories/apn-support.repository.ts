import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ApnSupportEntity } from '../entities/apn-support.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { ApnSupport } from '../../../../domain/apn-support';
import {
  ApnSupportRepository,
  ApnSupportRow,
} from '../../apn-support.repository';
import { ApnSupportMapper } from '../mappers/apn-support.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class ApnSupportRelationalRepository implements ApnSupportRepository {
  constructor(
    @InjectRepository(ApnSupportEntity)
    private readonly apnRepository: Repository<ApnSupportEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<[ApnSupport[], number]> {
    const [entities, count] = await this.apnRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      order: { apn: 'ASC' },
    });

    return [entities.map((e) => ApnSupportMapper.toDomain(e)), count];
  }

  async findAll(): Promise<ApnSupport[]> {
    const entities = await this.apnRepository.find({ order: { apn: 'ASC' } });
    return entities.map((e) => ApnSupportMapper.toDomain(e));
  }

  async findByApn(apn: string): Promise<NullableType<ApnSupport>> {
    const entity = await this.apnRepository.findOne({ where: { apn } });
    return entity ? ApnSupportMapper.toDomain(entity) : null;
  }

  async replaceAll(rows: ApnSupportRow[]): Promise<number> {
    // One transaction: a half-applied table would silently mark plans as
    // TikTok-incapable, which is worse than keeping the previous upload.
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ApnSupportEntity);
      await repo.clear();

      if (!rows.length) return 0;

      // Chunked because an APN sheet can run to thousands of rows and a single
      // INSERT with that many parameters exceeds what the driver accepts.
      const CHUNK = 500;
      for (let index = 0; index < rows.length; index += CHUNK) {
        await repo.insert(rows.slice(index, index + CHUNK));
      }

      return rows.length;
    });
  }

  async count(): Promise<number> {
    return this.apnRepository.count();
  }
}
