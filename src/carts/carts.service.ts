import { Injectable, NotFoundException } from '@nestjs/common';
import { CartRepository } from './infrastructure/persistence/cart.repository';
import { Cart } from './domain/cart';
import { CreateCartItemDto } from './dto/create-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { PlansService } from '../plans/plans.service';
import {
  discountedRetailVnd,
  multidayRetailVnd,
} from '../plans/multiday-price';

@Injectable()
export class CartsService {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly plansService: PlansService,
  ) {}

  /**
   * Each line carries the price checkout will charge. The storefront used to
   * work it out as (1-day price) × days, which showed 994 000 đ for a day pass
   * that costs 491 000 đ (vande-0411 #001).
   */
  async getCart(userId: number): Promise<Cart[]> {
    const items = await this.cartRepository.findByUserId(userId);
    if (!items.some((item) => item.plan)) return items;
    const tiers = await this.plansService.marginTiers();
    return items.map((item) =>
      item.plan
        ? {
            ...item,
            unitVndPrice: discountedRetailVnd(item.plan, item.periodNum, tiers),
            unitOriginalVndPrice: multidayRetailVnd(
              item.plan,
              Number(item.periodNum ?? 1),
              tiers,
            ),
          }
        : item,
    );
  }

  async addItem(userId: number, dto: CreateCartItemDto): Promise<Cart> {
    const periodNum = dto.periodNum ?? null;
    const existing = await this.cartRepository.findByUserIdPlanIdAndPeriodNum(
      userId,
      dto.planId,
      periodNum,
    );

    if (existing) {
      const updated = await this.cartRepository.update(existing.id, {
        quantity: existing.quantity + (dto.quantity ?? 1),
      });
      return updated!;
    }

    return this.cartRepository.create({
      userId,
      planId: dto.planId,
      quantity: dto.quantity ?? 1,
      periodNum,
    });
  }

  async updateItem(
    userId: number,
    itemId: number,
    dto: UpdateCartItemDto,
  ): Promise<Cart> {
    const items = await this.cartRepository.findByUserId(userId);
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Cart item not found');

    const updated = await this.cartRepository.update(itemId, {
      quantity: dto.quantity,
      periodNum: dto.periodNum ?? item.periodNum,
    });
    return updated!;
  }

  async removeItem(userId: number, itemId: number): Promise<void> {
    const items = await this.cartRepository.findByUserId(userId);
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Cart item not found');

    await this.cartRepository.remove(itemId);
  }

  async clearCart(userId: number): Promise<void> {
    await this.cartRepository.clearByUserId(userId);
  }
}
