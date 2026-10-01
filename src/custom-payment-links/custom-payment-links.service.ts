import { UsersService } from '../users/users.service';
import { User } from '../users/domain/user';

import {
  // common
  Injectable,
  HttpStatus,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CreateCustomPaymentLinkDto } from './dto/create-custom-payment-link.dto';
import { UpdateCustomPaymentLinkDto } from './dto/update-custom-payment-link.dto';
import {
  CustomPaymentLinkFilter,
  CustomPaymentLinkRepository,
} from './infrastructure/persistence/custom-payment-link.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { CustomPaymentLink } from './domain/custom-payment-link';
import { OnepayService } from '../payment/onepay.service';
import { AllConfigType } from '../config/config.type';
import {
  CustomPaymentLinkStatus,
  CUSTOM_PAYMENT_LINK_EXPIRY_MINUTES,
  CUSTOM_PAYMENT_VIRTUAL_ORDER_PREFIX,
} from './custom-payment-links.enum';
import { generateOrderNumber } from '../utils/order-number';

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
    filterOptions,
  }: {
    paginationOptions: IPaginationOptions;
    filterOptions?: CustomPaymentLinkFilter | null;
  }) {
    return this.customPaymentLinkRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
      filterOptions,
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

    const virtualOrderId = generateOrderNumber(
      CUSTOM_PAYMENT_VIRTUAL_ORDER_PREFIX,
    );

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
      // #041: open OnePay's card form directly instead of the method list.
      cardList: onepayCfg.customLinkCardList || undefined,
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
   *
   * Idempotent for a settled link, with one exception: a link the sweep gave up
   * on (#056) is still promoted to PAID by a late successful IPN. Auto-expiry is a
   * guess about silence, and a real payment must win over it — but only in that
   * direction, and never over a genuine failure or an admin's decision.
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

    const autoExpired =
      link.status === CustomPaymentLinkStatus.FAILED &&
      !!link.expiredAt &&
      !link.confirmedAt;

    if (link.status !== CustomPaymentLinkStatus.PENDING) {
      if (!(autoExpired && payload.isSuccess)) return link;
      this.logger.warn(
        `Custom payment link ${virtualOrderId} was auto-expired but OnePay reports success — promoting to PAID`,
      );
    }

    const updated = await this.customPaymentLinkRepository.update(link.id, {
      status: payload.isSuccess
        ? CustomPaymentLinkStatus.PAID
        : CustomPaymentLinkStatus.FAILED,
      paymentId: payload.paymentId ?? null,
      // Cleared on a promotion, so the record no longer reads as "expired".
      ...(autoExpired && payload.isSuccess ? { expiredAt: null } : {}),
    });

    return updated ?? link;
  }

  /**
   * An admin says what really happened to a pending link (#056).
   *
   * Needed because the outcome only ever arrived via OnePay's IPN: a customer who
   * paid on a device that never returned, or never paid at all, left the link in
   * "Chờ thanh toán" indefinitely.
   *
   * Only a pending or auto-expired link can be confirmed. A link OnePay already
   * settled, or another admin already confirmed, is left alone — overwriting that
   * would quietly rewrite a money record.
   */
  async confirmManually(
    id: CustomPaymentLink['id'],
    isPaid: boolean,
    adminUserId?: number,
  ): Promise<CustomPaymentLink> {
    const link = await this.customPaymentLinkRepository.findById(id);
    if (!link) {
      throw new NotFoundException(`Custom payment link ${id} not found`);
    }

    const autoExpired =
      link.status === CustomPaymentLinkStatus.FAILED &&
      !!link.expiredAt &&
      !link.confirmedAt;

    if (link.status !== CustomPaymentLinkStatus.PENDING && !autoExpired) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          status: `Link is already ${link.status} and cannot be confirmed again`,
        },
      });
    }

    const updated = await this.customPaymentLinkRepository.update(id, {
      status: isPaid
        ? CustomPaymentLinkStatus.PAID
        : CustomPaymentLinkStatus.FAILED,
      confirmedAt: new Date(),
      confirmedByAdminId: adminUserId ?? null,
      // An admin's word replaces the sweep's guess.
      expiredAt: null,
    });

    this.logger.log(
      `Admin ${adminUserId ?? 'unknown'} marked custom payment link ${link.virtualOrderId} as ${
        isPaid ? 'PAID' : 'FAILED'
      }`,
    );

    return updated ?? link;
  }

  /**
   * Move links nobody paid within OnePay's window out of the pending tab (#056).
   *
   * Every ten minutes rather than every minute: the window is 30 minutes, so this
   * is accurate to well inside it while costing one indexed statement per run.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireStaleLinks(): Promise<number> {
    const cutoff = new Date(
      Date.now() - CUSTOM_PAYMENT_LINK_EXPIRY_MINUTES * 60 * 1000,
    );

    const expired =
      await this.customPaymentLinkRepository.expirePendingCreatedBefore(cutoff);

    if (expired > 0) {
      this.logger.log(
        `Expired ${expired} custom payment link(s) unpaid after ${CUSTOM_PAYMENT_LINK_EXPIRY_MINUTES} minutes`,
      );
    }

    return expired;
  }
}
