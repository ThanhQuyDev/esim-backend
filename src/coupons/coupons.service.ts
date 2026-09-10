import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { NullableType } from '../utils/types/nullable.type';
import { FilterCouponDto, SortCouponDto } from './dto/query-coupon.dto';
import { CouponRepository } from './infrastructure/persistence/coupon.repository';
import { Coupon } from './domain/coupon';
import { IPaginationOptions } from '../utils/types/pagination-options';
import {
  ValidateCouponDto,
  ValidateCouponResponseDto,
} from './dto/validate-coupon.dto';
import {
  computeCouponDiscount,
  effectiveDiscountPercent,
} from './coupon-discount';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from '../orders/infrastructure/persistence/relational/entities/order.entity';

@Injectable()
export class CouponsService {
  constructor(
    private readonly couponRepository: CouponRepository,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
  ) {}

  async create(createCouponDto: CreateCouponDto): Promise<Coupon> {
    const existing = await this.couponRepository.findByCode(
      createCouponDto.code.toUpperCase(),
    );
    if (existing) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { code: 'codeAlreadyExists' },
      });
    }

    return this.couponRepository.create({
      code: createCouponDto.code.toUpperCase(),
      discountPercent: createCouponDto.discountPercent,
      discountType: createCouponDto.discountType ?? 'percent',
      discountAmount: createCouponDto.discountAmount ?? 0,
      maxDiscountAmount: createCouponDto.maxDiscountAmount ?? null,
      maxUsage: createCouponDto.maxUsage ?? null,
      maxUsagePerUser: createCouponDto.maxUsagePerUser ?? null,
      usageCount: 0,
      minOrderAmount: createCouponDto.minOrderAmount ?? null,
      expiresAt: createCouponDto.expiresAt
        ? new Date(createCouponDto.expiresAt)
        : null,
      isActive: createCouponDto.isActive ?? true,
      isPopular: createCouponDto.isPopular ?? false,
      // Codes are listed on the cart page unless the admin says otherwise.
      isPublic: createCouponDto.isPublic ?? true,
      partnerId: createCouponDto.partnerId ?? null,
    } as Coupon);
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterCouponDto | null;
    sortOptions?: SortCouponDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[Coupon[], number]> {
    return this.couponRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: Coupon['id']): Promise<NullableType<Coupon>> {
    return this.couponRepository.findById(id);
  }

  findByCode(code: string): Promise<NullableType<Coupon>> {
    return this.couponRepository.findByCode(code.toUpperCase());
  }

  async update(
    id: Coupon['id'],
    updateCouponDto: UpdateCouponDto,
  ): Promise<Coupon | null> {
    const payload: Partial<Coupon> = {};
    if (updateCouponDto.code !== undefined) {
      const code = updateCouponDto.code.toUpperCase();
      const existing = await this.couponRepository.findByCode(code);
      if (existing && existing.id !== Number(id)) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { code: 'codeAlreadyExists' },
        });
      }
      payload.code = code;
    }
    if (updateCouponDto.discountPercent !== undefined)
      payload.discountPercent = updateCouponDto.discountPercent;
    if (updateCouponDto.discountType !== undefined)
      payload.discountType = updateCouponDto.discountType;
    if (updateCouponDto.discountAmount !== undefined)
      payload.discountAmount = updateCouponDto.discountAmount;
    if (updateCouponDto.maxDiscountAmount !== undefined)
      payload.maxDiscountAmount = updateCouponDto.maxDiscountAmount;
    if (updateCouponDto.maxUsage !== undefined)
      payload.maxUsage = updateCouponDto.maxUsage;
    if (updateCouponDto.maxUsagePerUser !== undefined)
      payload.maxUsagePerUser = updateCouponDto.maxUsagePerUser;
    if (updateCouponDto.minOrderAmount !== undefined)
      payload.minOrderAmount = updateCouponDto.minOrderAmount;
    if (updateCouponDto.expiresAt !== undefined)
      payload.expiresAt = updateCouponDto.expiresAt
        ? new Date(updateCouponDto.expiresAt)
        : null;
    if (updateCouponDto.isActive !== undefined)
      payload.isActive = updateCouponDto.isActive;
    if (updateCouponDto.isPopular !== undefined)
      payload.isPopular = updateCouponDto.isPopular;
    if (updateCouponDto.isPublic !== undefined)
      payload.isPublic = updateCouponDto.isPublic;
    if (updateCouponDto.partnerId !== undefined)
      payload.partnerId = updateCouponDto.partnerId;

    return this.couponRepository.update(id, payload);
  }

  async validateCoupon(
    dto: ValidateCouponDto,
    userId: number,
  ): Promise<ValidateCouponResponseDto> {
    const coupon = await this.couponRepository.findByCode(
      dto.code.toUpperCase(),
    );
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    if (!coupon.isActive) {
      throw new BadRequestException('Coupon is inactive');
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      throw new BadRequestException('Coupon has expired');
    }

    if (coupon.maxUsage !== null && coupon.usageCount >= coupon.maxUsage) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    if (coupon.maxUsagePerUser !== null) {
      const userUsageCount = await this.orderRepo.count({
        where: { userId, couponCode: coupon.code, status: 'paid' },
      });
      if (userUsageCount >= coupon.maxUsagePerUser) {
        throw new BadRequestException(
          'You have reached the maximum usage for this coupon',
        );
      }
    }

    if (
      coupon.minOrderAmount !== null &&
      dto.orderAmount < coupon.minOrderAmount
    ) {
      throw new BadRequestException(
        `Minimum order amount is ${coupon.minOrderAmount}`,
      );
    }

    // Percentage, flat amount and "percent up to X" all resolve here (#082).
    const discountAmount = computeCouponDiscount(coupon, dto.orderAmount);
    const finalAmount =
      Math.round((dto.orderAmount - discountAmount) * 100) / 100;

    return {
      valid: true,
      discountPercent: coupon.discountPercent,
      discountType: coupon.discountType ?? 'percent',
      maxDiscountAmount: coupon.maxDiscountAmount ?? null,
      // The share actually taken off — a capped or flat code is no longer
      // described by its configured percentage.
      effectiveDiscountPercent: effectiveDiscountPercent(
        discountAmount,
        dto.orderAmount,
      ),
      discountAmount,
      finalAmount,
    };
  }

  async applyCoupon(couponCode: string): Promise<void> {
    const coupon = await this.couponRepository.findByCode(
      couponCode.toUpperCase(),
    );
    if (coupon) {
      await this.couponRepository.incrementUsage(coupon.id);
    }
  }

  async releaseCoupon(couponCode: string): Promise<void> {
    // Feature 3.1 — counterpart of applyCoupon. Used when an order is
    // cancelled before payment so the buyer can re-use the same code.
    const coupon = await this.couponRepository.findByCode(
      couponCode.toUpperCase(),
    );
    if (coupon) {
      await this.couponRepository.decrementUsage(coupon.id);
    }
  }

  async remove(id: Coupon['id']): Promise<void> {
    await this.couponRepository.remove(id);
  }
}
