import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DestinationEntity } from '../entities/destination.entity';
import { PlanEntity } from '../../../../../plans/infrastructure/persistence/relational/entities/plan.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import {
  FilterDestinationDto,
  SortDestinationDto,
} from '../../../../dto/query-destination.dto';
import { Destination } from '../../../../domain/destination';
import { DestinationRepository } from '../../destination.repository';
import { DestinationMapper } from '../mappers/destination.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { buildProvidersTextFilter } from '../../../../../utils/providers-text-filter';
import { applySafeSort } from '../../../../../utils/safe-sort';

@Injectable()
export class DestinationsRelationalRepository implements DestinationRepository {
  constructor(
    @InjectRepository(DestinationEntity)
    private readonly destinationsRepository: Repository<DestinationEntity>,
  ) {}

  async create(data: Destination): Promise<Destination> {
    const persistenceModel = DestinationMapper.toPersistence(data);
    const newEntity = await this.destinationsRepository.save(
      this.destinationsRepository.create(persistenceModel),
    );
    return DestinationMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterDestinationDto | null;
    sortOptions?: SortDestinationDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[Destination[], number]> {
    const qb = this.destinationsRepository
      .createQueryBuilder('destination')
      .addSelect((subQuery) => {
        return subQuery
          .select('MIN(plan."vndPrice")', 'fromPrice')
          .from(PlanEntity, 'plan')
          .where('plan."destinationId" = destination.id')
          .andWhere('plan."isActive" = true')
          .andWhere('plan."deletedAt" IS NULL');
      }, 'fromPrice')
      // Plans on sale now: the CMS column, and what the storefront lists by
      // (vande-1411 #031).
      .addSelect((subQuery) => {
        return subQuery
          .select('COUNT(*)', 'planCount')
          .from(PlanEntity, 'plan')
          .where('plan."destinationId" = destination.id')
          .andWhere('plan."isActive" = true')
          .andWhere('plan."deletedAt" IS NULL');
      }, 'planCount');

    if (filterOptions?.parentId !== undefined) {
      if (filterOptions.parentId === null) {
        qb.andWhere('destination.parentId IS NULL');
      } else {
        qb.andWhere('destination.parentId = :parentId', {
          parentId: filterOptions.parentId,
        });
      }
    }
    // Travel only unless asked: a domestic carrier is no country (vande-1411 #025).
    const esimType = filterOptions?.esimType ?? 'travel';
    if (esimType !== 'all') {
      qb.andWhere('COALESCE(destination.esimType, :travel) = :esimType', {
        travel: 'travel',
        esimType,
      });
    }
    if (filterOptions?.hasPlans) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM "plan" hp WHERE hp."destinationId" = destination.id AND hp."isActive" = true AND hp."deletedAt" IS NULL)`,
      );
    }
    if (filterOptions?.mobileHome) {
      qb.andWhere('destination.mobileHomeRank IS NOT NULL');
    }
    if (filterOptions?.isPopular !== undefined) {
      qb.andWhere('destination.isPopular = :isPopular', {
        isPopular: filterOptions.isPopular,
      });
    }
    if (filterOptions?.isActive !== undefined) {
      qb.andWhere('destination.isActive = :isActive', {
        isActive: filterOptions.isActive,
      });
    }
    const providersFilter = buildProvidersTextFilter(
      'destination',
      filterOptions?.providers,
    );
    if (providersFilter) {
      qb.andWhere(providersFilter.sql, providersFilter.params);
    }

    if (filterOptions?.search) {
      // Match the localized titles too, not just the internal `name`: the
      // storefront cards show `titleVi` / `title`, so a customer typing what
      // they can see must find the destination.
      // Slugs only for the CMS (`searchSlug`): every slug starts with "esim-",
      // so on the storefront "esim" or "sim" would match the entire catalogue.
      qb.andWhere(
        `(destination.name ILIKE :search
          OR destination.title ILIKE :search
          OR destination.titleVi ILIKE :search
          OR destination.keySearch ILIKE :search
          OR destination.countryCode ILIKE :search
          ${filterOptions.searchSlug ? 'OR destination.slug ILIKE :search OR destination.slugVi ILIKE :search' : ''})`,
        { search: `%${filterOptions.search}%` },
      );
    }

    qb.andWhere('destination.deletedAt IS NULL');

    // "Số lượng gói" sorts too (vande-2011 #019): it is counted, not stored,
    // so it is ordered by the same count; anything else goes through the
    // column whitelist.
    const byPlans = sortOptions?.find((s) => s?.orderBy === 'planCount');
    if (byPlans) {
      qb.addOrderBy(
        `(SELECT COUNT(*) FROM "plan" sp WHERE sp."destinationId" = destination.id
            AND sp."isActive" = true AND sp."deletedAt" IS NULL)`,
        String(byPlans.order ?? '').toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
      );
      qb.addOrderBy('destination.id', 'ASC');
    }
    const otherSorts = sortOptions?.filter((s) => s?.orderBy !== 'planCount');
    if (!applySafeSort(qb, 'destination', otherSorts) && !byPlans) {
      qb.addOrderBy('destination.createdAt', 'DESC');
    }

    const count = await qb.getCount();

    // offset/limit: an ORDER BY on a count does not survive take/skip's
    // two-query paging, and this query has no join that needs it.
    qb.offset((paginationOptions.page - 1) * paginationOptions.limit);
    qb.limit(paginationOptions.limit);

    const raw = await qb.getRawAndEntities();

    const data = raw.entities.map((entity, index) => {
      const domain = DestinationMapper.toDomain(entity);
      domain.fromPrice = raw.raw[index]?.fromPrice
        ? Number(raw.raw[index].fromPrice)
        : null;
      domain.planCount = Number(raw.raw[index]?.planCount ?? 0);
      return domain;
    });

    return [data, count];
  }

  async findById(id: Destination['id']): Promise<NullableType<Destination>> {
    const entity = await this.destinationsRepository.findOne({
      where: { id: Number(id) },
    });

    return entity ? DestinationMapper.toDomain(entity) : null;
  }

  async findRenamedSlug(slug: string): Promise<string | null> {
    try {
      const rows: { slug: string }[] = await this.destinationsRepository.query(
        `SELECT t.slug FROM slug_rename_2011 r
           JOIN "destination" t ON t.id = r."entityId" AND t."deletedAt" IS NULL
          WHERE r.kind = 'destination' AND r."oldSlug" = $1
          ORDER BY r.id DESC LIMIT 1`,
        [slug],
      );
      return rows[0]?.slug ?? null;
    } catch {
      // No rename table (a database the migration has not reached).
      return null;
    }
  }

  async findBySlug(
    slug: Destination['slug'],
  ): Promise<NullableType<Destination>> {
    const entity = await this.destinationsRepository.findOne({
      where: [{ slug }, { slugVi: slug }],
      relations: ['regions'],
    });

    return entity ? DestinationMapper.toDomain(entity) : null;
  }

  async findByCountryCode(
    countryCode: Destination['countryCode'],
  ): Promise<NullableType<Destination>> {
    const entity = await this.destinationsRepository.findOne({
      where: { countryCode },
    });

    return entity ? DestinationMapper.toDomain(entity) : null;
  }

  async findByName(
    name: Destination['name'],
  ): Promise<NullableType<Destination>> {
    const entity = await this.destinationsRepository.findOne({
      where: { name },
    });

    return entity ? DestinationMapper.toDomain(entity) : null;
  }

  async update(
    id: Destination['id'],
    payload: Partial<Destination>,
  ): Promise<Destination> {
    const entity = await this.destinationsRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('Destination not found');
    }

    const updatedEntity = await this.destinationsRepository.save(
      this.destinationsRepository.create(
        DestinationMapper.toPersistence({
          ...DestinationMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return DestinationMapper.toDomain(updatedEntity);
  }

  async addRegion(
    destinationId: Destination['id'],
    regionId: number,
  ): Promise<void> {
    const entity = await this.destinationsRepository.findOne({
      where: { id: Number(destinationId) },
      relations: ['regions'],
    });
    if (!entity) return;

    const alreadyLinked = entity.regions?.some((r) => r.id === regionId);
    if (alreadyLinked) return;

    await this.destinationsRepository
      .createQueryBuilder()
      .relation(DestinationEntity, 'regions')
      .of(destinationId)
      .add(regionId);
  }

  async remove(id: Destination['id']): Promise<void> {
    await this.destinationsRepository.softDelete(id);
  }
}
