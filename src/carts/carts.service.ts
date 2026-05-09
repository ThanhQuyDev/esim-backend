import { Injectable, NotFoundException } from '@nestjs/common';
import { CartRepository } from './infrastructure/persistence/cart.repository';
import { Cart } from './domain/cart';
import { CreateCartItemDto } from './dto/create-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartsService {
  constructor(private readonly cartRepository: CartRepository) {}

  async getCart(userId: number): Promise<Cart[]> {
    return this.cartRepository.findByUserId(userId);
  }

  async addItem(userId: number, dto: CreateCartItemDto): Promise<Cart> {
    const existing = await this.cartRepository.findByUserIdAndPlanId(
      userId,
      dto.planId,
    );

    if (existing) {
      const updated = await this.cartRepository.update(existing.id, {
        quantity: existing.quantity + (dto.quantity ?? 1),
        periodNum: dto.periodNum ?? existing.periodNum,
      });
      return updated!;
    }

    return this.cartRepository.create({
      userId,
      planId: dto.planId,
      quantity: dto.quantity ?? 1,
      periodNum: dto.periodNum ?? null,
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
