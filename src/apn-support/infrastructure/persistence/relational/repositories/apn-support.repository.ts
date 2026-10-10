import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ApnSupportEntity } from '../entities/apn-support.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { ApnSupport } from '../../../../domain/apn-support';
import {
  ApnSupportFilters,
  ApnSupportRepository,
  ApnSupportRow,
} from '../../apn-support.repository';
import { ApnSupportMapper } from '../mappers/apn-support.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

/** Filter key → the columns that must all be true (#044, test round 4). */
const SUPPORT_COLUMNS: Record<string, string[]> = {
  tiktokIos: ['tiktokIos'],
  tiktokAndroid: ['tiktokAndroid'],
  tiktok: ['tiktokIos', 'tiktokAndroid'],
  chatGpt: ['chatGptIos', 'chatGptAndroid'],
  gemini: ['geminiIos', 'geminiAndroid'],
  claude: ['claudeIos', 'claudeAndroid'],
};

@Injectable()
export class ApnSupportRelationalRepository implements ApnSupportRepository {
  constructor(
    @InjectRepository(ApnSupportEntity)
    private readonly apnRepository: Repository<ApnSupportEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findAllWithPagination({
    paginationOptions,
    filters,
  }: {
    paginationOptions: IPaginationOptions;
    filters?: ApnSupportFilters;
  }): Promise<[ApnSupport[], number]> {
    const qb = this.apnRepository.createQueryBuilder('apn');

    if (filters?.apns?.length) {
      qb.andWhere('apn.apn IN (:...apns)', {
        apns: filters.apns.map((value) => value.trim().toLowerCase()),
      });
    }

    // "tiktokIos" is one column; a bare app name ("chatGpt") means it works on
    // both devices (#044, test round 4). Unknown keys are ignored rather than
    // turned into SQL.
    for (const key of filters?.supports ?? []) {
      const columns = SUPPORT_COLUMNS[key];
      if (!columns) continue;
      for (const column of columns) {
        qb.andWhere(`apn."${column}" = true`);
      }
    }
    if (filters?.supports?.length) {
      qb.andWhere('apn."needsReview" = false');
    }

    if (filters?.needsReview !== undefined) {
      qb.andWhere('apn."needsReview" = :needsReview', {
        needsReview: filters.needsReview,
      });
    }

    // Rows still waiting for their answers first, so they are not missed.
    qb.orderBy('apn."needsReview"', 'DESC').addOrderBy('apn.apn', 'ASC');
    qb.skip((paginationOptions.page - 1) * paginationOptions.limit);
    qb.take(paginationOptions.limit);

    const [entities, count] = await qb.getManyAndCount();
    return [entities.map((e) => ApnSupportMapper.toDomain(e)), count];
  }

  async listApns(): Promise<{ apn: string; apnLabel: string }[]> {
    return this.apnRepository.find({
      select: { apn: true, apnLabel: true },
      order: { apn: 'ASC' },
    });
  }

  async findById(id: string): Promise<NullableType<ApnSupport>> {
    const entity = await this.apnRepository.findOne({ where: { id } });
    return entity ? ApnSupportMapper.toDomain(entity) : null;
  }

  async create(row: ApnSupportRow): Promise<ApnSupport> {
    const saved = await this.apnRepository.save(this.apnRepository.create(row));
    return ApnSupportMapper.toDomain(saved);
  }

  async update(
    id: string,
    patch: Partial<ApnSupportRow>,
  ): Promise<NullableType<ApnSupport>> {
    const entity = await this.apnRepository.findOne({ where: { id } });
    if (!entity) return null;
    const saved = await this.apnRepository.save({ ...entity, ...patch });
    return ApnSupportMapper.toDomain(saved);
  }

  async remove(id: string): Promise<void> {
    await this.apnRepository.delete(id);
  }

  async distinctPlanApns(): Promise<string[]> {
    const rows: { apn: string }[] = await this.dataSource.query(
      `SELECT DISTINCT TRIM(p.apn) AS apn
         FROM "plan" p
        WHERE p."deletedAt" IS NULL
          AND p.apn IS NOT NULL
          AND TRIM(p.apn) <> ''`,
    );
    return rows.map((row) => row.apn);
  }

  async insertMissing(rows: ApnSupportRow[]): Promise<number> {
    if (!rows.length) return 0;
    const result = await this.apnRepository
      .createQueryBuilder()
      .insert()
      .into(ApnSupportEntity)
      .values(rows)
      .orIgnore()
      .execute();
    // Postgres returns only the rows actually inserted; conflicts are skipped.
    return Array.isArray(result.raw) ? result.raw.length : 0;
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
