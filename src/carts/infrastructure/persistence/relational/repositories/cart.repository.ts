import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartEntity } from '../entities/cart.entity';
import { Cart } from '../../../../domain/cart';
import { CartRepository } from '../../cart.repository';
import { CartMapper } from '../mappers/cart.mapper';
import { NullableType } from '../../../../../utils/types/nullable.type';

@Injectable()
export class CartsRelationalRepository implements CartRepository {
  constructor(
    @InjectRepository(CartEntity)
    private readonly cartRepository: Repository<CartEntity>,
  ) {}

  async findByUserId(userId: number): Promise<Cart[]> {
    const entities = await this.cartRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return entities.map(CartMapper.toDomain);
  }

  async findByUserIdAndPlanId(
    userId: number,
    planId: number,
  ): Promise<NullableType<Cart>> {
    const entity = await this.cartRepository.findOne({
      where: { userId, planId },
    });
    return entity ? CartMapper.toDomain(entity) : null;
  }

  async create(data: Cart): Promise<Cart> {
    const entity = await this.cartRepository.save(
      this.cartRepository.create(CartMapper.toPersistence(data)),
    );
    return CartMapper.toDomain(entity);
  }

  async update(id: number, payload: Partial<Cart>): Promise<Cart | null> {
    const entity = await this.cartRepository.findOne({ where: { id } });
    if (!entity) return null;

    const updated = await this.cartRepository.save(
      this.cartRepository.create(
        CartMapper.toPersistence({
          ...CartMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );
    return CartMapper.toDomain(updated);
  }

  async remove(id: number): Promise<void> {
    await this.cartRepository.delete(id);
  }

  async clearByUserId(userId: number): Promise<void> {
    await this.cartRepository.delete({ userId });
  }
}
