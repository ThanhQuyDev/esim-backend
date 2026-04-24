import { NullableType } from '../../../utils/types/nullable.type';
import { Cart } from '../../domain/cart';

export abstract class CartRepository {
  abstract findByUserId(userId: number): Promise<Cart[]>;

  abstract findByUserIdAndPlanId(
    userId: number,
    planId: number,
  ): Promise<NullableType<Cart>>;

  abstract create(
    data: Omit<Cart, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Cart>;

  abstract update(id: number, payload: Partial<Cart>): Promise<Cart | null>;

  abstract remove(id: number): Promise<void>;

  abstract clearByUserId(userId: number): Promise<void>;
}
