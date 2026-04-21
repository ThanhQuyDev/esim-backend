import { Coupon } from '../../../../domain/coupon';
import { CouponEntity } from '../entities/coupon.entity';

export class CouponMapper {
  static toDomain(raw: CouponEntity): Coupon {
    const domain = new Coupon();
    domain.id = raw.id;
    domain.code = raw.code;
    domain.discountPercent = Number(raw.discountPercent);
    domain.maxUsage = raw.maxUsage;
    domain.maxUsagePerUser = raw.maxUsagePerUser;
    domain.usageCount = raw.usageCount;
    domain.minOrderAmount = raw.minOrderAmount ? Number(raw.minOrderAmount) : null;
    domain.expiresAt = raw.expiresAt;
    domain.isActive = raw.isActive;
    domain.createdAt = raw.createdAt;
    domain.updatedAt = raw.updatedAt;
    domain.deletedAt = raw.deletedAt;
    return domain;
  }

  static toPersistence(domain: Coupon): CouponEntity {
    const entity = new CouponEntity();
    if (domain.id) entity.id = domain.id;
    entity.code = domain.code;
    entity.discountPercent = domain.discountPercent;
    entity.maxUsage = domain.maxUsage;
    entity.maxUsagePerUser = domain.maxUsagePerUser;
    entity.usageCount = domain.usageCount;
    entity.minOrderAmount = domain.minOrderAmount;
    entity.expiresAt = domain.expiresAt;
    entity.isActive = domain.isActive;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    entity.deletedAt = domain.deletedAt;
    return entity;
  }
}
