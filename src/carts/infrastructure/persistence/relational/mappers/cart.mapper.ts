import { Cart } from '../../../../domain/cart';
import { CartEntity } from '../entities/cart.entity';
import { PlanMapper } from '../../../../../plans/infrastructure/persistence/relational/mappers/plan.mapper';

export class CartMapper {
  static toDomain(raw: CartEntity): Cart {
    const domain = new Cart();
    domain.id = raw.id;
    domain.userId = raw.userId;
    domain.planId = raw.planId;
    if (raw.plan) {
      const planDomain = PlanMapper.toDomain(raw.plan);
      const { costPrice, price, retailPrice, ...rest } = planDomain;
      void costPrice;
      void price;
      void retailPrice;
      domain.plan = rest;
    }
    domain.quantity = raw.quantity;
    domain.createdAt = raw.createdAt;
    domain.updatedAt = raw.updatedAt;
    return domain;
  }

  static toPersistence(domain: Cart): CartEntity {
    const entity = new CartEntity();
    if (domain.id && typeof domain.id === 'number') {
      entity.id = domain.id;
    }
    entity.userId = domain.userId;
    entity.planId = domain.planId;
    entity.quantity = domain.quantity;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    return entity;
  }
}
