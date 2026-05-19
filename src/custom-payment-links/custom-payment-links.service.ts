import { UsersService } from '../users/users.service';
import { User } from '../users/domain/user';

import {
  // common
  Injectable,
  HttpStatus,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateCustomPaymentLinkDto } from './dto/create-custom-payment-link.dto';
import { UpdateCustomPaymentLinkDto } from './dto/update-custom-payment-link.dto';
import { CustomPaymentLinkRepository } from './infrastructure/persistence/custom-payment-link.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { CustomPaymentLink } from './domain/custom-payment-link';
import { OnepayService } from '../payment/onepay.service';
import { AllConfigType } from '../config/config.type';
import {
  CustomPaymentLinkStatus,
  CUSTOM_PAYMENT_VIRTUAL_ORDER_PREFIX,
} from './custom-payment-links.enum';

export interface CreateCustomLinkInput {
  customerEmail: string;
  amount: number;
  currency: string;
  description: string;
  clientIp: string;
  adminUserId?: number;
}

@Injectable()
export class CustomPaymentLinksService {
  private readonly logger = new Logger(CustomPaymentLinksService.name);

  constructor(
    private readonly userService: UsersService,
    private readonly onepayService: OnepayService,
    private readonly configService: ConfigService<AllConfigType>,

    // Dependencies here
    private readonly customPaymentLinkRepository: CustomPaymentLinkRepository,
  ) {}

  async create(createCustomPaymentLinkDto: CreateCustomPaymentLinkDto) {
    // Do not remove comment below.
    // <creating-property />
    let createdBy: User | null | undefined = undefined;

    if (createCustomPaymentLinkDto.createdBy) {
      const createdByObject = await this.userService.findById(
        createCustomPaymentLinkDto.createdBy.id,
      );
      if (!createdByObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            createdBy: 'notExists',
          },
        });
      }
      createdBy = createdByObject;
    } else if (createCustomPaymentLinkDto.createdBy === null) {
      createdBy = null;
    }

    return this.customPaymentLinkRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      createdBy,

      paymentId: createCustomPaymentLinkDto.paymentId,

      status: createCustomPaymentLinkDto.status,

      paymentUrl: createCustomPaymentLinkDto.paymentUrl,

      description: createCustomPaymentLinkDto.description,

      currency: createCustomPaymentLinkDto.currency,

      amount: createCustomPaymentLinkDto.amount,

      customerEmail: createCustomPaymentLinkDto.customerEmail,

      virtualOrderId: createCustomPaymentLinkDto.virtualOrderId,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.customPaymentLinkRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: CustomPaymentLink['id']) {
    return this.customPaymentLinkRepository.findById(id);
  }

  findByIds(ids: CustomPaymentLink['id'][]) {
    return this.customPaymentLinkRepository.findByIds(ids);
  }

  async update(
    id: CustomPaymentLink['id'],

    updateCustomPaymentLinkDto: UpdateCustomPaymentLinkDto,
  ) {
    // Do not remove comment below.
    // <updating-property />
    let createdBy: User | null | undefined = undefined;

    if (updateCustomPaymentLinkDto.createdBy) {
      const createdByObject = await this.userService.findById(
        updateCustomPaymentLinkDto.createdBy.id,
      );
      if (!createdByObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            createdBy: 'notExists',
          },
        });
      }
      createdBy = createdByObject;
    } else if (updateCustomPaymentLinkDto.createdBy === null) {
      createdBy = null;
    }

    return this.customPaymentLinkRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      createdBy,

      paymentId: updateCustomPaymentLinkDto.paymentId,

      status: updateCustomPaymentLinkDto.status,

      paymentUrl: updateCustomPaymentLinkDto.paymentUrl,

      description: updateCustomPaymentLinkDto.description,

      currency: updateCustomPaymentLinkDto.currency,

      amount: updateCustomPaymentLinkDto.amount,

      customerEmail: updateCustomPaymentLinkDto.customerEmail,

      virtualOrderId: updateCustomPaymentLinkDto.virtualOrderId,
    });
  }

  remove(id: CustomPaymentLink['id']) {
    return this.customPaymentLinkRepository.remove(id);
  }

  /**
   * Feature 2.1 — Create a custom OnePay credit-card payment URL for an
   * arbitrary amount. Used by sales/admins to bill wholesale or off-catalogue
   * eSIM packages without exposing them on the storefront.
   */
  async createCustomLink(
    input: CreateCustomLinkInput,
  ): Promise<CustomPaymentLink> {
    const currency = (input.currency || 'VND').toUpperCase();
    if (currency !== 'VND') {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { currency: 'OnePay custom links currently support VND only' },
      });
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { amount: 'must be a positive number' },
      });
    }

    const virtualOrderId = `${CUSTOM_PAYMENT_VIRTUAL_ORDER_PREFIX}${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;

    let createdBy: User | null = null;
    if (input.adminUserId !== undefined) {
      const adminUser = await this.userService.findById(input.adminUserId);
      if (adminUser) createdBy = adminUser;
    }

    const onepayCfg = this.configService.getOrThrow('onepay', { infer: true });
    const paymentUrl = this.onepayService.buildPaymentUrl({
      orderNumber: virtualOrderId,
      vndAmount: Math.round(input.amount),
      clientIp: input.clientIp,
      orderInfo: input.description.slice(0, 200),
      againLink: onepayCfg.returnUrl,
      title: 'esim.vn — Custom Payment',
    });

    const created = await this.customPaymentLinkRepository.create({
      virtualOrderId,
      customerEmail: input.customerEmail,
      amount: Math.round(input.amount),
      currency,
      description: input.description,
      paymentUrl,
      status: CustomPaymentLinkStatus.PENDING,
      paymentId: null,
      createdById: createdBy ? Number(createdBy.id) : null,
      createdBy,
    });

    this.logger.log(
      `Created custom payment link ${virtualOrderId} for ${input.customerEmail} (${currency} ${input.amount})`,
    );

    return created;
  }

  findByVirtualOrderId(virtualOrderId: string) {
    return this.customPaymentLinkRepository.findByVirtualOrderId(
      virtualOrderId,
    );
  }

  /**
   * Mark a custom payment link as PAID/FAILED based on the OnePay IPN result.
   * Idempotent — a link that's already in a terminal state is not re-updated.
   */
  async finalizeFromIpn(
    virtualOrderId: string,
    payload: { isSuccess: boolean; paymentId?: string | null },
  ): Promise<CustomPaymentLink | null> {
    const link =
      await this.customPaymentLinkRepository.findByVirtualOrderId(
        virtualOrderId,
      );
    if (!link) return null;
    if (link.status !== CustomPaymentLinkStatus.PENDING) return link;

    const updated = await this.customPaymentLinkRepository.update(link.id, {
      status: payload.isSuccess
        ? CustomPaymentLinkStatus.PAID
        : CustomPaymentLinkStatus.FAILED,
      paymentId: payload.paymentId ?? null,
    });

    return updated ?? link;
  }
}
