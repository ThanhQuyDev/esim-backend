import { Plan } from '../../../../domain/plan';
import { PlanEntity } from '../entities/plan.entity';
import { DestinationMapper } from '../../../../../destinations/infrastructure/persistence/relational/mappers/destination.mapper';
import { RegionMapper } from '../../../../../regions/infrastructure/persistence/relational/mappers/region.mapper';

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
    domainEntity.dataGb = raw.dataGb;
    domainEntity.costPrice = raw.costPrice;
    domainEntity.price = raw.price;
    domainEntity.retailPrice = raw.retailPrice;
    domainEntity.currency = raw.currency;
    domainEntity.type = raw.type;
    domainEntity.topUp = raw.topUp;
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
    persistenceEntity.dataGb = domainEntity.dataGb;
    persistenceEntity.costPrice = domainEntity.costPrice;
    persistenceEntity.price = domainEntity.price;
    persistenceEntity.retailPrice = domainEntity.retailPrice;
    persistenceEntity.currency = domainEntity.currency;
    persistenceEntity.type = domainEntity.type;
    persistenceEntity.topUp = domainEntity.topUp;
    persistenceEntity.isActive = domainEntity.isActive;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;
    return persistenceEntity;
  }
}
