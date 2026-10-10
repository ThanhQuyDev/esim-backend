import { Plan } from '../../../../domain/plan';
import { PlanEntity } from '../entities/plan.entity';
import { DestinationMapper } from '../../../../../destinations/infrastructure/persistence/relational/mappers/destination.mapper';
import { RegionMapper } from '../../../../../regions/infrastructure/persistence/relational/mappers/region.mapper';
import {
  DAILY_RESET_POLICIES,
  DailyResetPolicyEnum,
} from '../../../../plan-daily-reset';

export class PlanMapper {
  static toDomain(raw: PlanEntity): Plan {
    const domainEntity = new Plan();
    domainEntity.id = raw.id;
    domainEntity.provider = raw.provider;
    domainEntity.providerPlanId = raw.providerPlanId;
    domainEntity.name = raw.name;
    domainEntity.slug = raw.slug;
    domainEntity.countryCode = raw.countryCode;
    domainEntity.destinationId = raw.destinationId;
    if (raw.destination) {
      domainEntity.destination = DestinationMapper.toDomain(raw.destination);
    }
    domainEntity.regionId = raw.regionId;
    if (raw.region) {
      domainEntity.region = RegionMapper.toDomain(raw.region);
    }
    domainEntity.durationDays = raw.durationDays;
    domainEntity.dataMb = raw.dataMb;
    domainEntity.costPrice = raw.costPrice;
    domainEntity.price = raw.price;
    domainEntity.retailPrice = raw.retailPrice;
    domainEntity.currency = raw.currency;
    domainEntity.sms = raw.sms;
    domainEntity.call = raw.call;
    domainEntity.type = raw.type;
    domainEntity.topUp = raw.topUp;
    domainEntity.speed = raw.speed;
    domainEntity.operatorName = raw.operatorName;
    domainEntity.fupSpeed = raw.fupSpeed;
    domainEntity.isAbleMultidate = raw.isAbleMultidate;
    domainEntity.isCheapest = raw.isCheapest;
    domainEntity.soldCount = Number(raw.soldCount ?? 0);
    domainEntity.discount = raw.discount;
    domainEntity.vndPrice = Number(raw.vndPrice);
    domainEntity.usdPrice = Number(raw.usdPrice ?? 0);
    domainEntity.usdCostPrice = Number(raw.usdCostPrice ?? 0);
    domainEntity.usdRetailPrice = Number(raw.usdRetailPrice ?? 0);
    domainEntity.vndCostPrice = Number(raw.vndCostPrice ?? 0);
    domainEntity.vndRetailPrice = Number(raw.vndRetailPrice ?? 0);
    domainEntity.isNonHkIp = !!raw.isNonHkIp;
    domainEntity.ipExport = raw.ipExport ?? null;
    domainEntity.activationValidUntil = raw.activationValidUntil ?? null;
    domainEntity.isKyc = raw.isKyc;
    domainEntity.isLocalInventory = raw.isLocalInventory;
    domainEntity.isDomesticEsim = raw.isDomesticEsim;
    domainEntity.tags = raw.tags ?? null;
    domainEntity.apn = raw.apn;
    domainEntity.activationValidityDays =
      raw.activationValidityDays != null
        ? Number(raw.activationValidityDays)
        : null;
    // Stored as text, so an unrecognised value (hand-edited row, a policy an
    // older build wrote) reads back as "not stated" instead of leaking a string
    // the storefront has no copy for.
    domainEntity.dailyResetPolicy = DAILY_RESET_POLICIES.includes(
      raw.dailyResetPolicy as DailyResetPolicyEnum,
    )
      ? (raw.dailyResetPolicy as DailyResetPolicyEnum)
      : null;
    domainEntity.dailyResetUtcOffset =
      raw.dailyResetUtcOffset != null ? Number(raw.dailyResetUtcOffset) : null;
    domainEntity.hotSpot = raw.hotSpot;
    domainEntity.hotSpotAllow = raw.hotSpotAllow;
    domainEntity.lastSyncedAt = raw.lastSyncedAt;
    domainEntity.isActive = raw.isActive;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: Plan): PlanEntity {
    const persistenceEntity = new PlanEntity();
    if (domainEntity.id && typeof domainEntity.id === 'number') {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.provider = domainEntity.provider;
    persistenceEntity.providerPlanId = domainEntity.providerPlanId;
    persistenceEntity.name = domainEntity.name;
    persistenceEntity.slug = domainEntity.slug;
    persistenceEntity.countryCode = domainEntity.countryCode;
    persistenceEntity.destinationId = domainEntity.destinationId;
    persistenceEntity.regionId = domainEntity.regionId;
    persistenceEntity.durationDays = domainEntity.durationDays;
    persistenceEntity.dataMb = domainEntity.dataMb;
    persistenceEntity.costPrice = domainEntity.costPrice;
    persistenceEntity.price = domainEntity.price;
    persistenceEntity.retailPrice = domainEntity.retailPrice;
    persistenceEntity.currency = domainEntity.currency;
    persistenceEntity.sms = domainEntity.sms;
    persistenceEntity.call = domainEntity.call;
    persistenceEntity.type = domainEntity.type;
    persistenceEntity.topUp = domainEntity.topUp;
    persistenceEntity.speed = domainEntity.speed;
    persistenceEntity.operatorName = domainEntity.operatorName;
    persistenceEntity.fupSpeed = domainEntity.fupSpeed;
    persistenceEntity.isAbleMultidate = domainEntity.isAbleMultidate;
    persistenceEntity.isCheapest = domainEntity.isCheapest;
    // Owned by the recount job; an ordinary save keeps whatever it last wrote.
    if (domainEntity.soldCount !== undefined) {
      persistenceEntity.soldCount = domainEntity.soldCount;
    }
    persistenceEntity.discount = domainEntity.discount;
    persistenceEntity.vndPrice = domainEntity.vndPrice;
    persistenceEntity.usdPrice = domainEntity.usdPrice;
    persistenceEntity.usdCostPrice = domainEntity.usdCostPrice;
    persistenceEntity.usdRetailPrice = domainEntity.usdRetailPrice;
    persistenceEntity.vndCostPrice = domainEntity.vndCostPrice;
    persistenceEntity.vndRetailPrice = domainEntity.vndRetailPrice;
    persistenceEntity.isNonHkIp = domainEntity.isNonHkIp;
    if (domainEntity.activationValidUntil !== undefined) {
      persistenceEntity.activationValidUntil =
        domainEntity.activationValidUntil;
    }
    if (domainEntity.ipExport !== undefined) {
      persistenceEntity.ipExport = domainEntity.ipExport;
    }
    persistenceEntity.isKyc = domainEntity.isKyc;
    persistenceEntity.isLocalInventory = domainEntity.isLocalInventory;
    persistenceEntity.isDomesticEsim = domainEntity.isDomesticEsim;
    persistenceEntity.tags = domainEntity.tags ?? null;
    persistenceEntity.apn = domainEntity.apn;
    persistenceEntity.activationValidityDays =
      domainEntity.activationValidityDays ?? null;
    persistenceEntity.dailyResetPolicy = domainEntity.dailyResetPolicy ?? null;
    persistenceEntity.dailyResetUtcOffset =
      domainEntity.dailyResetUtcOffset ?? null;
    persistenceEntity.hotSpot = domainEntity.hotSpot;
    persistenceEntity.hotSpotAllow = domainEntity.hotSpotAllow;
    persistenceEntity.lastSyncedAt = domainEntity.lastSyncedAt;
    persistenceEntity.isActive = domainEntity.isActive;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;
    return persistenceEntity;
  }
}
