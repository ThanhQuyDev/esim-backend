import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { CouponEntity } from '../entities/coupon.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import {
  FilterCouponDto,
  SortCouponDto,
} from '../../../../dto/query-coupon.dto';
import { Coupon } from '../../../../domain/coupon';
import { CouponRepository } from '../../coupon.repository';
import { CouponMapper } from '../mappers/coupon.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class CouponsRelationalRepository implements CouponRepository {
  constructor(
    @InjectRepository(CouponEntity)
    private readonly couponRepository: Repository<CouponEntity>,
  ) {}

  async create(data: Coupon): Promise<Coupon> {
    const persistenceModel = CouponMapper.toPersistence(data);
    const newEntity = await this.couponRepository.save(
      this.couponRepository.create(persistenceModel),
    );
    return CouponMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterCouponDto | null;
    sortOptions?: SortCouponDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Coupon[]> {
    const where: FindOptionsWhere<CouponEntity> = {};

    if (filterOptions?.isActive !== undefined) {
      where.isActive = filterOptions.isActive;
    }
    if (filterOptions?.search) {
      where.code = ILike(`%${filterOptions.search}%`);
    }

    const entities = await this.couponRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      where,
      order: sortOptions?.length
        ? sortOptions.reduce(
            (accumulator, sort) => ({
              ...accumulator,
              [sort.orderBy]: sort.order,
            }),
            {},
          )
        : { createdAt: 'DESC' },
    });

    return entities.map((entity) => CouponMapper.toDomain(entity));
  }

  async findById(id: Coupon['id']): Promise<NullableType<Coupon>> {
    const entity = await this.couponRepository.findOne({
      where: { id: Number(id) },
    });
    return entity ? CouponMapper.toDomain(entity) : null;
  }

  async findByCode(code: string): Promise<NullableType<Coupon>> {
    const entity = await this.couponRepository.findOne({
      where: { code },
    });
    return entity ? CouponMapper.toDomain(entity) : null;
  }

  async update(id: Coupon['id'], payload: Partial<Coupon>): Promise<Coupon> {
    const entity = await this.couponRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('Coupon not found');
    }

    const updatedEntity = await this.couponRepository.save(
      this.couponRepository.create(
        CouponMapper.toPersistence({
          ...CouponMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return CouponMapper.toDomain(updatedEntity);
  }

  async incrementUsage(id: Coupon['id']): Promise<void> {
    await this.couponRepository
      .createQueryBuilder()
      .update(CouponEntity)
      .set({ usageCount: () => '"usageCount" + 1' })
      .where('id = :id', { id })
      .execute();
  }

  async remove(id: Coupon['id']): Promise<void> {
    await this.couponRepository.softDelete(id);
  }
}
