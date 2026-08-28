import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../config/config.type';
import { Order } from '../orders/domain/order';
import { OrderRepository } from '../orders/infrastructure/persistence/order.repository';
import { EsimsService } from '../esims/esims.service';
import { PlansService } from '../plans/plans.service';
import { AiraloService } from '../esim-providers/airalo/airalo.service';
import { EsimAccessService } from '../esim-providers/esimaccess/esimaccess.service';
import { GadgetKoreaService } from '../esim-providers/gadgetkorea/gadgetkorea.service';
import { BillionService } from '../esim-providers/billion/billion.service';
import { MicroEsimService } from '../esim-providers/microesim/microesim.service';
import { AiraloTopupPackage } from '../esim-providers/airalo/airalo-api.types';
import { EsimAccessPackage } from '../esim-providers/esimaccess/esimaccess-api.types';
import { OnepayService } from '../payment/onepay.service';
import {
  generateBankTransferCode,
  buildVietQrUrl,
} from '../payment/bank-transfer.util';
import { ProfitMarginsService } from '../profit-margins/profit-margins.service';
import { TopupPackageDto, TopupProvider } from './dto/topup-package.dto';
import { TopupCheckoutDto } from './dto/topup-checkout.dto';
import {
  OrderType,
  TOPUP_ORDER_NUMBER_PREFIX,
  TOPUP_ORDER_STATUS,
} from './topup.constants';
import { Plan } from '../plans/domain/plan';
import { FilterPlanDto } from '../plans/dto/query-plan.dto';

const PROVIDER_NAME_TO_ENUM: Record<string, TopupProvider> = {
  airalo: TopupProvider.AIRALO,
  esimaccess: TopupProvider.ESIM_ACCESS,
  gadgetkorea: TopupProvider.GADGET_KOREA,
  billion: TopupProvider.BILLION,
  microesim: TopupProvider.MICRO_ESIM,
};

const ENUM_TO_PROVIDER_NAME: Record<TopupProvider, string> = {
  [TopupProvider.AIRALO]: 'airalo',
  [TopupProvider.ESIM_ACCESS]: 'esimaccess',
  [TopupProvider.GADGET_KOREA]: 'gadgetkorea',
  [TopupProvider.BILLION]: 'billion',
  [TopupProvider.MICRO_ESIM]: 'microesim',
};

const VND_ROUNDING_UNIT = 1000;

/**
 * Providers whose SIMs cannot currently be topped up, even though we catalogue
 * their plans. MICRO_ESIM's public API exposes no recharge endpoint (its
 * `esimSubscribe` only creates brand-new eSIMs and cannot target an existing
 * device — verified against the official Postman collection 2026-08-25), so we
 * must refuse a topup BEFORE the customer pays rather than collect money and
 * fail at execute time. Remove a provider from this set once a real recharge
 * path is wired.
 */
const TOPUP_UNSUPPORTED_PROVIDERS: ReadonlySet<TopupProvider> = new Set([
  TopupProvider.MICRO_ESIM,
]);

function roundVndToThousands(amount: number): number {
  return Math.round(amount / VND_ROUNDING_UNIT) * VND_ROUNDING_UNIT;
}

function formatDataLabel(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  const gb = bytes / 1024 / 1024 / 1024;
  if (gb >= 1) {
    const rounded = Math.round(gb * 10) / 10;
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} GB`;
  }
  const mb = bytes / 1024 / 1024;
  return `${Math.round(mb)} MB`;
}

@Injectable()
export class TopupService {
  private readonly logger = new Logger(TopupService.name);

  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly esimsService: EsimsService,
    private readonly plansService: PlansService,
    private readonly airaloService: AiraloService,
    private readonly esimAccessService: EsimAccessService,
    private readonly gadgetKoreaService: GadgetKoreaService,
    private readonly billionService: BillionService,
    private readonly microEsimService: MicroEsimService,
    private readonly onepayService: OnepayService,
    private readonly profitMarginsService: ProfitMarginsService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  /**
   * Returns the unified topup package list for an iccid.
   * Auto-detects the source provider by looking up the eSIM record.
   */
  async listPackages(iccid: string): Promise<{
    iccid: string;
    provider: TopupProvider;
    packages: TopupPackageDto[];
  }> {
    const { provider, esim } = await this.resolveProviderForIccid(iccid);

    // Providers we catalogue but cannot recharge (e.g. MicroEsim) return an
    // empty list so the FE shows "no packages" and never reaches checkout.
    if (TOPUP_UNSUPPORTED_PROVIDERS.has(provider)) {
      this.logger.log(
        `listPackages: provider ${provider} does not support topup; returning empty list for iccid=${iccid}`,
      );
      return { iccid, provider, packages: [] };
    }

    const vndRate = await this.fetchVndRate().catch(() => null);

    let packages: TopupPackageDto[] = [];
    if (provider === TopupProvider.AIRALO) {
      const list = await this.airaloService.listTopupPackages(iccid);
      packages = await Promise.all(
        list.map((p) => this.mapAiraloPackage(p, vndRate)),
      );
    } else if (provider === TopupProvider.ESIM_ACCESS) {
      const list = await this.esimAccessService.listTopupPackagesByIccid(iccid);
      packages = await Promise.all(
        list.map((p) => this.mapEsimAccessPackage(p, vndRate)),
      );
    } else {
      // GADGET_KOREA / BILLION / MICRO_ESIM — these providers have no
      // "topups eligible for this SIM" API, so we offer topup plans from our
      // own `plan` table, matched to the source SIM's country/region/type.
      const sourcePlan = esim.planId
        ? await this.plansService.findById(esim.planId)
        : null;
      const providerName = ENUM_TO_PROVIDER_NAME[provider];
      packages = await this.listDbCataloguePackages(
        providerName,
        provider,
        sourcePlan,
      );
    }

    return { iccid, provider, packages };
  }

  /**
   * Creates a pending TOPUP order and builds the OnePay payment URL.
   * Provider's API is NOT called here — only at IPN-paid time.
   */
  /**
   * Validate the request and create the pending TOPUP order shared by both
   * checkout flows (OnePay and bank transfer). Returns the created order plus
   * the resolved VND amount so callers can build their payment instructions.
   */
  private async createPendingTopupOrder(
    userId: number,
    dto: TopupCheckoutDto,
  ): Promise<{ order: Order; vndAmount: number }> {
    const { provider } = await this.resolveProviderForIccid(dto.iccid);
    if (provider !== dto.provider) {
      throw new BadRequestException(
        `Provider mismatch: iccid resolves to ${provider} but payload says ${dto.provider}`,
      );
    }

    // Defense in depth: block checkout for providers we cannot recharge before
    // any money is collected. listPackages already returns [] for these, so a
    // well-behaved client never gets here — this stops a hand-crafted request.
    if (TOPUP_UNSUPPORTED_PROVIDERS.has(provider)) {
      throw new BadRequestException(
        `Provider ${provider} does not support topup for existing eSIMs`,
      );
    }

    // Look up the package server-side so the price cannot be tampered with.
    const { packages } = await this.listPackages(dto.iccid);
    const pkg = packages.find((p) => p.packageId === dto.packageId);
    if (!pkg) {
      throw new NotFoundException(
        `Package ${dto.packageId} not available for iccid ${dto.iccid}`,
      );
    }

    const vndAmount =
      pkg.vndPrice && pkg.vndPrice > 0
        ? pkg.vndPrice
        : roundVndToThousands(
            (await this.fetchVndRate().catch(() => 26000)) * pkg.retailPrice,
          );

    const orderNumber = `${TOPUP_ORDER_NUMBER_PREFIX}-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;

    const order = await this.orderRepository.create({
      userId,
      orderNumber,
      status: TOPUP_ORDER_STATUS.PENDING,
      orderType: OrderType.TOPUP,
      targetIccid: dto.iccid,
      topupProvider: dto.provider,
      topupPackageId: dto.packageId,
      totalAmount: pkg.retailPrice,
      currency: 'USD',
      paymentMethod: dto.paymentMethod,
      paymentId: null,
      couponCode: null,
      discountAmount: 0,
      vndPrice: vndAmount,
      vndCostPrice: 0,
      subtotalVndPrice: vndAmount,
      couponDiscountVndAmount: 0,
      referralCode: null,
      referrerUserId: null,
      referralDiscountVndAmount: 0,
      walletSpentVndAmount: 0,
      payableVndPrice: vndAmount,
      cashbackAmountVnd: 0,
      cashbackTransactionId: null,
      cashbackReversedAt: null,
      refundStatus: null,
      refundedAmountVnd: 0,
    });

    return { order, vndAmount };
  }

  /**
   * Bank-transfer (SePay / Techcombank) topup checkout. Creates the same
   * pending TOPUP order as {@link checkout} but attaches a short transfer
   * reference code instead of building an OnePay URL; the SePay webhook
   * finalizes the order and triggers {@link executeTopup}.
   */
  async checkoutBankTransfer(
    userId: number,
    dto: TopupCheckoutDto,
  ): Promise<{
    success: true;
    orderId: string;
    bankTransferCode: string;
    qrUrl: string;
    amount: number;
    accountNumber: string;
    accountName: string;
    bankCode: string;
  }> {
    const sepay = this.configService.getOrThrow('sepay', { infer: true });
    if (!sepay.accountNumber) {
      throw new BadRequestException(
        'Bank transfer is not configured (missing SEPAY_ACCOUNT_NUMBER)',
      );
    }

    const { order } = await this.createPendingTopupOrder(userId, dto);

    const bankTransferCode = generateBankTransferCode();
    await this.orderRepository.update(order.id, {
      paymentMethod: 'bank_transfer',
      bankTransferCode,
    });

    const qrUrl = buildVietQrUrl({
      bankCode: sepay.bankCode,
      accountNumber: sepay.accountNumber,
      accountName: sepay.accountName,
      amountVnd: order.vndPrice,
      transferCode: bankTransferCode,
    });

    this.logger.log(
      `Topup bank-transfer checkout: orderNumber=${order.orderNumber} code=${bankTransferCode} vnd=${order.vndPrice}`,
    );

    return {
      success: true,
      orderId: order.orderNumber,
      bankTransferCode,
      qrUrl,
      amount: order.vndPrice,
      accountNumber: sepay.accountNumber,
      accountName: sepay.accountName,
      bankCode: sepay.bankCode,
    };
  }

  async checkout(
    userId: number,
    dto: TopupCheckoutDto,
    clientIp: string,
  ): Promise<{
    success: true;
    orderId: string;
    paymentUrl: string;
  }> {
    const { order } = await this.createPendingTopupOrder(userId, dto);

    const paymentUrl = this.onepayService.buildPaymentUrl({
      orderNumber: order.orderNumber,
      vndAmount: order.vndPrice,
      clientIp,
      orderInfo: `esim.vn - Topup ${order.orderNumber}`,
      title: 'esim.vn eSIM Topup',
    });

    this.logger.log(
      `Topup checkout created: orderNumber=${order.orderNumber} iccid=${dto.iccid} provider=${dto.provider} package=${dto.packageId} vnd=${order.vndPrice}`,
    );

    return {
      success: true,
      orderId: order.orderNumber,
      paymentUrl,
    };
  }

  /**
   * After OnePay IPN marks an order PAID, this triggers the provider-side
   * topup submission. Designed to be fire-and-forget (don't make the IPN
   * await this — return early and let this run in the background).
   *
   * Failure path: status flips to `MANUAL_INTERVENTION` so admin can
   * either retry or refund.
   */
  async executeTopup(orderNumber: string): Promise<void> {
    const order = await this.orderRepository.findByOrderNumber(orderNumber);
    if (!order) {
      this.logger.error(`executeTopup: order ${orderNumber} not found`);
      return;
    }
    if (order.orderType !== OrderType.TOPUP) {
      this.logger.warn(
        `executeTopup: order ${orderNumber} is not a TOPUP (type=${order.orderType}); skipping`,
      );
      return;
    }
    if (
      order.status === TOPUP_ORDER_STATUS.COMPLETED ||
      order.status === TOPUP_ORDER_STATUS.MANUAL_INTERVENTION
    ) {
      this.logger.log(
        `executeTopup: order ${orderNumber} already finalized (status=${order.status}); skipping`,
      );
      return;
    }

    const provider = order.topupProvider as TopupProvider | undefined;
    const packageId = order.topupPackageId;
    const iccid = order.targetIccid;

    if (!provider || !packageId || !iccid) {
      this.logger.error(
        `executeTopup: order ${orderNumber} missing provider/package/iccid`,
      );
      await this.markManualIntervention(
        order,
        'Missing provider/package/iccid metadata',
      );
      return;
    }

    try {
      if (provider === TopupProvider.AIRALO) {
        await this.airaloService.submitTopup({
          packageId,
          iccid,
          description: `Topup for ${orderNumber}`,
        });
      } else if (provider === TopupProvider.ESIM_ACCESS) {
        await this.esimAccessService.submitTopup({
          iccid,
          packageCode: packageId,
          transactionId: orderNumber,
        });
      } else if (provider === TopupProvider.GADGET_KOREA) {
        const esim = await this.esimsService.findByIccid(iccid);
        if (!esim || !esim.esimTranNo) {
          throw new Error(
            `Gadget Korea topup requires esim.esimTranNo (topupId) but it was missing for iccid=${iccid}`,
          );
        }
        await this.gadgetKoreaService.submitTopup({
          topupId: esim.esimTranNo,
          optionId: packageId,
        });
      } else if (provider === TopupProvider.BILLION) {
        // BILLION recharge (F007) keys directly on the ICCID + plan skuId — it
        // does NOT reference the original F040 order. packageId is the skuId.
        await this.billionService.submitTopup({
          channelOrderId: `${orderNumber}-tu`,
          channelSubOrderId: `${orderNumber}-tu-1`,
          iccid,
          skuId: packageId,
          copies: 1,
        });
      } else if (provider === TopupProvider.MICRO_ESIM) {
        // MicroEsim recharge is keyed on the provider order (topup_id, stored as
        // order-item.orderRequestId) + the eSIM device_id (esim.esimTranNo).
        const esim = await this.esimsService.findByIccid(iccid);
        if (!esim || !esim.esimTranNo) {
          throw new Error(
            `MicroEsim topup requires esim.esimTranNo (device_id) but it was missing for iccid=${iccid}`,
          );
        }
        const orderRequestId = await this.resolveProviderOrderRef(esim.id);
        if (!orderRequestId) {
          throw new Error(
            `MicroEsim topup requires the provider topup_id (order-item.orderRequestId) but it was missing for iccid=${iccid}`,
          );
        }
        await this.microEsimService.submitTopup({
          topupId: orderRequestId,
          deviceId: esim.esimTranNo,
          channelDataplanId: packageId,
          customOrderNo: `${orderNumber}-tu`,
        });
      } else {
        throw new Error(`Unsupported provider ${provider}`);
      }

      await this.orderRepository.update(order.id, {
        status: TOPUP_ORDER_STATUS.COMPLETED,
      });

      this.logger.log(
        `Topup executed successfully: orderNumber=${orderNumber} provider=${provider}`,
      );
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(
        `executeTopup failed for ${orderNumber} (provider=${provider}): ${message}`,
      );
      await this.markManualIntervention(order, message);
    }
  }

  // -- helpers ----------------------------------------------------

  private async resolveProviderForIccid(iccid: string): Promise<{
    provider: TopupProvider;
    esim: NonNullable<Awaited<ReturnType<EsimsService['findByIccid']>>>;
  }> {
    const esim = await this.esimsService.findByIccid(iccid);
    if (!esim) {
      throw new NotFoundException(`ICCID ${iccid} not found`);
    }
    const providerName = (esim.provider ?? '').toLowerCase();
    const provider = PROVIDER_NAME_TO_ENUM[providerName];
    if (!provider) {
      throw new BadRequestException(
        `ICCID ${iccid} belongs to provider '${esim.provider ?? 'unknown'}' which does not support topup`,
      );
    }
    return { provider, esim };
  }

  /**
   * Resolve the provider-side order reference (`order-item.orderRequestId`)
   * for a given eSIM. BILLION stores its F040 `orderId` there; MicroEsim
   * stores its `topup_id`. Both are needed to target a recharge at the
   * existing profile. Mirrors the relation walk used in EsimsService.getDataUsage.
   */
  private async resolveProviderOrderRef(
    esimId: number,
  ): Promise<string | null> {
    const esimWithRelations =
      await this.esimsService.findByIdWithRelations(esimId);
    return (
      (esimWithRelations as { orderItem?: { orderRequestId?: string | null } })
        ?.orderItem?.orderRequestId ?? null
    );
  }

  private async markManualIntervention(
    order: Order,
    reason: string,
  ): Promise<void> {
    try {
      await this.orderRepository.update(order.id, {
        status: TOPUP_ORDER_STATUS.MANUAL_INTERVENTION,
      });
      this.logger.warn(
        `Order ${order.orderNumber} flagged MANUAL_INTERVENTION: ${reason}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to flag MANUAL_INTERVENTION on ${order.orderNumber}: ${(err as Error).message}`,
      );
    }
  }

  private async mapAiraloPackage(
    pkg: AiraloTopupPackage,
    vndRate: number | null,
  ): Promise<TopupPackageDto> {
    const dataAmountBytes = pkg.is_unlimited
      ? 0
      : Math.round(pkg.amount * 1024 * 1024); // amount is MB
    const dataAmountText = pkg.is_unlimited
      ? 'Unlimited'
      : formatDataLabel(dataAmountBytes);

    // `net_price` is our cost (what Airalo charges us); apply our profit tiers
    // on top of it — exactly like SIM pricing — instead of reselling Airalo's
    // own retail price. Falls back to provider retail if the FX rate is down.
    const costPriceUsd = pkg.net_price;
    const vndPrice =
      vndRate != null
        ? await this.profitMarginsService.calculateRetailVndFromCostUsd(
            costPriceUsd,
            vndRate,
          )
        : undefined;
    const retailPriceUsd =
      vndPrice != null && vndRate ? vndPrice / vndRate : pkg.price;

    return {
      provider: TopupProvider.AIRALO,
      packageId: pkg.id,
      name: pkg.title,
      dataAmountBytes,
      dataAmountText,
      durationDays: pkg.day,
      isUnlimited: pkg.is_unlimited,
      price: costPriceUsd,
      retailPrice: retailPriceUsd,
      vndPrice,
    };
  }

  private async mapEsimAccessPackage(
    pkg: EsimAccessPackage,
    vndRate: number | null,
  ): Promise<TopupPackageDto> {
    const dataAmountBytes = pkg.volume; // already in bytes
    const isUnlimited = pkg.dataType === 4;
    const dataAmountText = isUnlimited
      ? 'Unlimited'
      : formatDataLabel(dataAmountBytes);

    // `price` (÷10000) is our cost; apply our profit tiers on top of it rather
    // than reselling the provider's retailPrice, so topup margin matches SIM
    // sales. Falls back to provider retail if the FX rate is down.
    const costPriceUsd = pkg.price / 10000;
    const vndPrice =
      vndRate != null
        ? await this.profitMarginsService.calculateRetailVndFromCostUsd(
            costPriceUsd,
            vndRate,
          )
        : undefined;
    const retailPriceUsd =
      vndPrice != null && vndRate
        ? vndPrice / vndRate
        : pkg.retailPrice / 10000;

    return {
      provider: TopupProvider.ESIM_ACCESS,
      packageId: pkg.packageCode,
      name: pkg.name,
      dataAmountBytes,
      dataAmountText,
      durationDays: pkg.duration,
      isUnlimited,
      price: costPriceUsd,
      retailPrice: retailPriceUsd,
      vndPrice,
    };
  }

  /**
   * List topup packages from our own `plan` table for providers that have no
   * "topups eligible for this SIM" API (GADGET_KOREA, BILLION, MICRO_ESIM).
   *
   * We match on the source SIM's original plan (country/region + type) so the
   * offered topups are compatible with the SIM. Without a source plan we fall
   * back to all active plans for that provider.
   */
  private async listDbCataloguePackages(
    providerName: string,
    providerEnum: TopupProvider,
    sourcePlan: Plan | null,
  ): Promise<TopupPackageDto[]> {
    const filter: FilterPlanDto = {
      provider: [providerName],
      isActive: true,
    };

    if (sourcePlan?.destinationId) {
      filter.destinationId = sourcePlan.destinationId;
    } else if (sourcePlan?.regionId) {
      filter.regionId = sourcePlan.regionId;
    }
    if (sourcePlan?.type) {
      filter.type = sourcePlan.type;
    }

    const [plans] = await this.plansService.findManyWithPagination({
      filterOptions: filter,
      sortOptions: null,
      paginationOptions: { page: 1, limit: 100 },
    });

    return plans.map((plan) => {
      const dataAmountBytes = (plan.dataMb ?? 0) * 1024 * 1024;
      const isUnlimited =
        plan.type === 'unlimited' || plan.type === 'unlimited-reduce';
      return {
        provider: providerEnum,
        packageId: plan.providerPlanId,
        name: plan.name,
        dataAmountBytes,
        dataAmountText: isUnlimited
          ? 'Unlimited'
          : formatDataLabel(dataAmountBytes),
        durationDays: plan.durationDays,
        isUnlimited,
        price: plan.costPrice,
        retailPrice: plan.retailPrice || plan.price,
        vndPrice: plan.vndPrice ?? undefined,
      };
    });
  }

  /**
   * Provider name normalised so callers can map back the other way
   * if needed (kept for symmetry with PROVIDER_NAME_TO_ENUM).
   */
  static toProviderName(provider: TopupProvider): string {
    return ENUM_TO_PROVIDER_NAME[provider];
  }

  private async fetchVndRate(): Promise<number> {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) throw new Error(`Exchange rate API error: ${res.status}`);
    const data = await res.json();
    const rate: number = data?.rates?.VND;
    if (!rate) throw new Error('VND rate not found');
    return rate;
  }
}
