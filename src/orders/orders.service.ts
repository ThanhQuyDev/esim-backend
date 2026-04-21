import { Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { SubmitOrderDto } from './dto/submit-order.dto';
import { NullableType } from '../utils/types/nullable.type';
import { FilterOrderDto, SortOrderDto } from './dto/query-order.dto';
import { OrderRepository } from './infrastructure/persistence/order.repository';
import { Order } from './domain/order';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { PlansService } from '../plans/plans.service';
import { OrderItemsService } from '../order-items/order-items.service';
import { AiraloService } from '../esim-providers/airalo/airalo.service';
import { EsimAccessService } from '../esim-providers/esimaccess/esimaccess.service';
import { GadgetKoreaService } from '../esim-providers/gadgetkorea/gadgetkorea.service';
import { AllConfigType } from '../config/config.type';
import { CouponsService } from '../coupons/coupons.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly plansService: PlansService,
    private readonly orderItemsService: OrderItemsService,
    private readonly airaloService: AiraloService,
    private readonly esimAccessService: EsimAccessService,
    private readonly gadgetKoreaService: GadgetKoreaService,
    private readonly configService: ConfigService<AllConfigType>,
    @Inject(forwardRef(() => CouponsService))
    private readonly couponsService: CouponsService,
  ) {}

  create(createOrderDto: CreateOrderDto): Promise<Order> {
    return this.orderRepository.create({
      userId: createOrderDto.userId,
      orderNumber: createOrderDto.orderNumber,
      status: createOrderDto.status ?? 'pending',
      totalAmount: createOrderDto.totalAmount,
      currency: createOrderDto.currency,
      paymentMethod: createOrderDto.paymentMethod,
      paymentId: createOrderDto.paymentId,
      couponCode: null,
      discountAmount: 0,
    });
  }

  async submitOrder(userId: number, dto: SubmitOrderDto): Promise<Order> {
    // 1. Resolve all plans and validate
    const planDetails = await Promise.all(
      dto.items.map(async (item) => {
        const plan = await this.plansService.findById(item.planId);
        if (!plan) {
          throw new NotFoundException(`Plan ${item.planId} not found`);
        }
        return { ...item, plan };
      }),
    );

    // 2. Calculate total
    const totalAmount = planDetails.reduce(
      (sum, item) => sum + item.plan.price * item.quantity,
      0,
    );

    // 2.5 Apply coupon if provided
    let discountAmount = 0;
    let couponCode: string | null = null;
    if (dto.couponCode) {
      const couponResult = await this.couponsService.validateCoupon(
        { code: dto.couponCode, orderAmount: totalAmount },
        userId,
      );
      discountAmount = couponResult.discountAmount;
      couponCode = dto.couponCode.toUpperCase();
    }

    const finalAmount = Math.round((totalAmount - discountAmount) * 100) / 100;

    // 3. Create order
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const order = await this.orderRepository.create({
      userId,
      orderNumber,
      status: 'pending',
      totalAmount: finalAmount,
      currency: dto.currency,
      paymentMethod: dto.paymentMethod ?? null,
      paymentId: dto.paymentId ?? null,
      couponCode,
      discountAmount,
    });

    // 4. Group items by provider
    const airaloItems = planDetails.filter((i) => i.plan.provider === 'airalo');
    const esimAccessItems = planDetails.filter(
      (i) => i.plan.provider === 'esimaccess',
    );
    const gadgetKoreaItems = planDetails.filter(
      (i) => i.plan.provider === 'gadgetkorea',
    );

    // 5. Call Airalo API — one call per plan
    for (const item of airaloItems) {
      let orderRequestId: string | null = null;
      try {
        const backendDomain = this.configService.getOrThrow(
          'app.backendDomain',
          { infer: true },
        );
        const webhookUrl = `${backendDomain}/api/v1/webhooks/airalo`;

        const result = await this.airaloService.submitOrderAsync({
          packageId: item.plan.providerPlanId,
          quantity: item.quantity,
          type: 'sim',
          webhookUrl,
        });
        orderRequestId = result.request_id ?? null;
      } catch (err) {
        this.logger.error(
          `Airalo order failed for plan ${item.planId}: ${(err as Error).message}`,
        );
      }

      await this.orderItemsService.create({
        orderId: order.id,
        planId: item.planId,
        orderRequestId,
        status: 'pending',
        price: item.plan.price,
        currency: dto.currency,
        quantity: item.quantity,
      });
    }

    // 6. Call EsimAccess API — one call for all esimaccess items
    if (esimAccessItems.length > 0) {
      const totalEsimAccessAmount = esimAccessItems.reduce(
        (sum, i) => sum + i.plan.costPrice * i.quantity,
        0,
      );
      const txnId = `${orderNumber}-esimaccess`;

      let esimAccessOrderNo: string | null = null;
      try {
        const result = await this.esimAccessService.submitOrder({
          transactionId: txnId,
          amount: Math.round(totalEsimAccessAmount * 10000),
          packageInfoList: esimAccessItems.map((i) => ({
            packageCode: i.plan.providerPlanId,
            count: i.quantity,
            price: Math.round(i.plan.costPrice * 10000),
          })),
        });
        esimAccessOrderNo = result.orderNo ?? null;
      } catch (err) {
        this.logger.error(`EsimAccess order failed: ${(err as Error).message}`);
      }

      for (const item of esimAccessItems) {
        await this.orderItemsService.create({
          orderId: order.id,
          planId: item.planId,
          orderRequestId: esimAccessOrderNo,
          status: 'pending',
          price: item.plan.price,
          currency: dto.currency,
          quantity: item.quantity,
        });
      }
    }

    // 7. Call Gadget Korea API — one call for all gadgetkorea items
    if (gadgetKoreaItems.length > 0) {
      const gkOrderId = `${orderNumber}-gk`;
      // Map optionId -> topupId after response
      const topupIdMap = new Map<string, string>();
      try {
        const result = await this.gadgetKoreaService.submitOrder({
          orderId: gkOrderId,
          products: gadgetKoreaItems.map((i) => ({
            optionId: i.plan.providerPlanId.toLowerCase(),
            qty: i.quantity,
          })),
        });
        // result.products: [{ topupId, optionId }]
        for (const p of result.products ?? []) {
          if (p.topupId && p.optionId) {
            topupIdMap.set(p.optionId.toLowerCase(), p.topupId);
          }
        }
      } catch (err) {
        this.logger.error(
          `Gadget Korea order failed: ${(err as Error).message}`,
        );
      }

      for (const item of gadgetKoreaItems) {
        const topupId =
          topupIdMap.get(item.plan.providerPlanId.toLowerCase()) ?? null;
        await this.orderItemsService.create({
          orderId: order.id,
          planId: item.planId,
          orderRequestId: topupId,
          status: 'pending',
          price: item.plan.price,
          currency: dto.currency,
          quantity: item.quantity,
        });
      }
    }

    // Increment coupon usage after order created
    if (couponCode) {
      await this.couponsService.applyCoupon(couponCode);
    }

    return order;
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterOrderDto | null;
    sortOptions?: SortOrderDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Order[]> {
    return this.orderRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: Order['id']): Promise<NullableType<Order>> {
    return this.orderRepository.findById(id);
  }

  async update(
    id: Order['id'],
    updateOrderDto: UpdateOrderDto,
  ): Promise<Order | null> {
    return this.orderRepository.update(id, {
      ...(updateOrderDto.userId !== undefined && {
        userId: updateOrderDto.userId,
      }),
      ...(updateOrderDto.orderNumber !== undefined && {
        orderNumber: updateOrderDto.orderNumber,
      }),
      ...(updateOrderDto.status !== undefined && {
        status: updateOrderDto.status,
      }),
      ...(updateOrderDto.totalAmount !== undefined && {
        totalAmount: updateOrderDto.totalAmount,
      }),
      ...(updateOrderDto.currency !== undefined && {
        currency: updateOrderDto.currency,
      }),
      ...(updateOrderDto.paymentMethod !== undefined && {
        paymentMethod: updateOrderDto.paymentMethod,
      }),
      ...(updateOrderDto.paymentId !== undefined && {
        paymentId: updateOrderDto.paymentId,
      }),
    });
  }

  async remove(id: Order['id']): Promise<void> {
    await this.orderRepository.remove(id);
  }
}
