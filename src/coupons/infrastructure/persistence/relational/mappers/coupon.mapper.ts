import { Coupon } from '../../../../domain/coupon';
import { CouponEntity } from '../entities/coupon.entity';

export class CouponMapper {
  static toDomain(raw: CouponEntity): Coupon {
    const domain = new Coupon();
    domain.id = raw.id;
    domain.code = raw.code;
    domain.discountPercent = Number(raw.discountPercent);
    domain.discountType = raw.discountType ?? 'percent';
    domain.discountAmount = Number(raw.discountAmount ?? 0);
    domain.maxDiscountAmount =
      raw.maxDiscountAmount === null || raw.maxDiscountAmount === undefined
        ? null
        : Number(raw.maxDiscountAmount);
    domain.maxUsage = raw.maxUsage;
    domain.maxUsagePerUser = raw.maxUsagePerUser;
    domain.usageCount = raw.usageCount;
    domain.minOrderAmount = raw.minOrderAmount
      ? Number(raw.minOrderAmount)
      : null;
    domain.expiresAt = raw.expiresAt;
    domain.isActive = raw.isActive;
    domain.isPopular = raw.isPopular;
    domain.isPublic = raw.isPublic;
    domain.partnerId = raw.partnerId ?? null;
    domain.partnerName = raw.partner?.contactName ?? null;
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
    entity.discountType = domain.discountType ?? 'percent';
    entity.discountAmount = domain.discountAmount ?? 0;
    entity.maxDiscountAmount = domain.maxDiscountAmount ?? null;
    entity.maxUsage = domain.maxUsage;
    entity.maxUsagePerUser = domain.maxUsagePerUser;
    entity.usageCount = domain.usageCount;
    entity.minOrderAmount = domain.minOrderAmount;
    entity.expiresAt = domain.expiresAt;
    entity.isActive = domain.isActive;
    entity.isPopular = domain.isPopular;
    entity.isPublic = domain.isPublic ?? true;
    if (domain.partnerId !== undefined) {
      entity.partnerId = domain.partnerId;
    }
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    entity.deletedAt = domain.deletedAt;
    return entity;
  }
}
