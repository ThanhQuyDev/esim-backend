import { NullableType } from '../../../utils/types/nullable.type';
import { Coupon } from '../../domain/coupon';
import { FilterCouponDto, SortCouponDto } from '../../dto/query-coupon.dto';
import { IPaginationOptions } from '../../../utils/types/pagination-options';

export abstract class CouponRepository {
  abstract create(
    data: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<Coupon>;
  abstract findManyWithPagination(options: {
    filterOptions?: FilterCouponDto | null;
    sortOptions?: SortCouponDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[Coupon[], number]>;
  abstract findById(id: Coupon['id']): Promise<NullableType<Coupon>>;
  abstract findByCode(code: string): Promise<NullableType<Coupon>>;
  abstract update(id: Coupon['id'], payload: Partial<Coupon>): Promise<Coupon>;
  abstract incrementUsage(id: Coupon['id']): Promise<void>;
  abstract remove(id: Coupon['id']): Promise<void>;
}
