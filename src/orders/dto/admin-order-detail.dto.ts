import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Esim } from '../../esims/domain/esim';
import { Coupon } from '../../coupons/domain/coupon';

export class AdminOrderUserDto {
  @ApiProperty({ type: Number })
  id: number | string;

  @ApiPropertyOptional({ type: String })
  email: string | null;

  @ApiPropertyOptional({ type: String })
  firstName: string | null;

  @ApiPropertyOptional({ type: String })
  lastName: string | null;

  @ApiPropertyOptional({ type: String })
  phoneNumber: string | null;
}

export class AdminPlanLocationInfoDto {
  @ApiProperty({
    type: String,
    example: 'DESTINATION',
    enum: ['DESTINATION', 'REGION'],
  })
  type: string;

  @ApiPropertyOptional({ type: String, example: 'CN' })
  locationCode: string | null;

  @ApiProperty({ type: String, example: 'china' })
  slug: string;

  @ApiPropertyOptional({
    type: String,
    example: 'eSIM China - High Speed Mobile Network',
  })
  title: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'eSIM Trung Quốc (Mainland) - Tốc độ cao',
  })
  titleVi: string | null;

  @ApiPropertyOptional({ type: String, example: '/img/destinations/china.jpg' })
  thumbnailUrl: string | null;
}

export class AdminOrderItemPlanDto {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  slug: string;

  @ApiProperty({ type: Number })
  durationDays: number;

  @ApiProperty({ type: Number })
  dataMb: number;

  @ApiProperty({ type: Number })
  price: number;

  @ApiProperty({ type: Number })
  vndPrice: number;

  @ApiProperty({ type: String })
  currency: string;

  @ApiPropertyOptional({ type: String })
  speed: string | null;

  /** Throttled speed after the high-speed allowance runs out. */
  @ApiPropertyOptional({ type: String })
  fupSpeed: string | null;

  @ApiPropertyOptional({ type: String })
  operatorName: string | null;

  @ApiPropertyOptional({ type: String })
  countryCode: string | null;

  @ApiPropertyOptional({ type: String })
  provider: string | null;

  @ApiPropertyOptional({ type: () => AdminPlanLocationInfoDto })
  locationInfo?: AdminPlanLocationInfoDto | null;

  /**
   * Call minutes / SMS of the plan (#019, test round 4). Without them the
   * order page could neither name a call/SMS plan as such nor show the
   * "Phút gọi / SMS" row the eSIM pages have.
   */
  @ApiPropertyOptional({ type: Number, nullable: true })
  call?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  sms?: number | null;
}

export class AdminOrderItemDto {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: Number })
  planId: number;

  @ApiPropertyOptional({ type: () => AdminOrderItemPlanDto })
  plan?: AdminOrderItemPlanDto | null;

  @ApiPropertyOptional({ type: String })
  orderRequestId: string | null;

  @ApiPropertyOptional({ type: String })
  providerOrderId: string | null;

  @ApiPropertyOptional({ type: String })
  providerOrderCode: string | null;

  @ApiProperty({ type: String })
  status: string;

  @ApiProperty({ type: Number })
  price: number;

  @ApiProperty({ type: String })
  currency: string;

  @ApiProperty({ type: Number })
  quantity: number;

  @ApiProperty({ type: Number })
  vndPrice: number;

  @ApiProperty({ type: Number })
  vndCostPrice: number;

  @ApiPropertyOptional({
    type: Number,
    description:
      "This line's share of the order discount (coupon + referral), by price (#009).",
  })
  discountShareVnd?: number;

  @ApiPropertyOptional({
    type: Number,
    description:
      'Line price after its discount share — what a refund of it pays.',
  })
  netVndPrice?: number;

  @ApiPropertyOptional({ type: () => [Esim] })
  esims?: Esim[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class AdminOrderInvoiceDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id: string;

  @ApiProperty({
    type: String,
    enum: ['PENDING', 'ISSUED', 'FAILED'],
    example: 'PENDING',
  })
  status: string;

  @ApiProperty({ type: String, example: 'Công ty TNHH ABC' })
  companyName: string;

  @ApiProperty({ type: String, example: '0123456789' })
  taxCode: string;

  @ApiProperty({ type: String, example: '123 Nguyễn Huệ, Q1, TP.HCM' })
  address: string;

  @ApiProperty({ type: String, example: '+84901234567' })
  invoicePhone: string;

  @ApiProperty({ type: String, example: 'finance@example.com' })
  invoiceEmail: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

/**
 * The affiliate behind an order, and what the order earned them (#095).
 * Null on an ordinary order — most orders have no partner.
 */
export class AdminOrderPartnerCommissionDto {
  @ApiProperty({ type: Number })
  partnerId: number;

  @ApiPropertyOptional({ type: String })
  partnerName?: string | null;

  @ApiPropertyOptional({ type: String })
  partnerStatus?: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'Referral link the buyer arrived through, when there was one.',
  })
  linkCode?: string | null;

  @ApiProperty({ type: Number, description: 'Commission owed, in VND.' })
  commissionVnd: number;

  @ApiProperty({
    type: Number,
    description:
      'Share of the order this commission came to, derived from the order value.',
  })
  commissionPercent: number;

  @ApiProperty({
    type: String,
    description: 'pending | credited | reversed | rejected',
  })
  status: string;

  @ApiPropertyOptional({
    type: String,
    description:
      'Why a rejected commission earned nothing: self_account, self_email, self_phone, self_tax_code or self_bank_account (#041).',
  })
  rejectionReason?: string | null;

  @ApiPropertyOptional({ type: String })
  tierSnapshot?: string | null;
}

/**
 * A topup order, in full (#015).
 *
 * The page could not even tell a topup apart from an ordinary order: none of
 * `orderType`, `targetIccid` or the package details reached the client. Without
 * the eSIM being topped up there is also nothing to reconcile the result against.
 */
export class AdminOrderTopupDto {
  @ApiProperty({ type: String, example: '89852245280001354019' })
  targetIccid: string;

  @ApiPropertyOptional({ type: String, example: 'AIRALO' })
  provider: string | null;

  @ApiPropertyOptional({ type: String })
  packageId: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '3 GB - 100 SMS - 100 Mins - 30 Days',
  })
  packageName: string | null;

  @ApiPropertyOptional({ type: String, example: '3 GB' })
  dataText: string | null;

  @ApiPropertyOptional({ type: Number, example: 30 })
  durationDays: number | null;

  @ApiProperty({ type: Boolean })
  isUnlimited: boolean;

  /** The eSIM being topped up, so the result can be checked against it. */
  @ApiPropertyOptional({ type: () => AdminTopupTargetEsimDto, nullable: true })
  targetEsim: AdminTopupTargetEsimDto | null;
}

export class AdminTopupTargetEsimDto {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String })
  iccid: string;

  @ApiProperty({ type: String })
  status: string;

  @ApiPropertyOptional({ type: String })
  provider: string | null;

  @ApiPropertyOptional({ type: String })
  planName: string | null;

  @ApiPropertyOptional({ type: String })
  dataUsed: string | null;

  @ApiPropertyOptional({ type: String })
  dataTotal: string | null;

  @ApiPropertyOptional({ type: Date })
  expiresAt: Date | null;

  @ApiPropertyOptional({ type: Date })
  activatedAt: Date | null;

  /** The order this eSIM was originally bought on, when there was one. */
  @ApiPropertyOptional({ type: Number })
  originalOrderId: number | null;
}

/** An order's money before and after its refunds (#009, test round 4). */
export class AdminOrderAfterRefundDto {
  @ApiProperty({ type: Number, description: 'Cash + eXU paid, as ordered.' })
  originalOrderValueVnd: number;

  @ApiProperty({ type: Number, description: 'Cash + eXU paid, less refunds.' })
  orderValueVnd: number;

  @ApiProperty({ type: Number })
  originalVndCostPrice: number;

  @ApiProperty({
    type: Number,
    description: 'Cost less the refunded lines / eSIMs.',
  })
  vndCostPrice: number;

  @ApiProperty({ type: Number })
  originalTotalAmount: number;

  @ApiProperty({
    type: Number,
    description: 'USD total scaled to what is left of the order.',
  })
  totalAmount: number;

  @ApiProperty({ type: Number })
  refundedVnd: number;

  @ApiProperty({ type: Number, description: 'Refunded into the eXU wallet.' })
  refundedToWalletVnd: number;

  @ApiProperty({ type: Number, description: 'Refunded by bank transfer.' })
  refundedDirectVnd: number;

  @ApiProperty({ type: Number, description: 'eXU cashback the order earned.' })
  originalCashbackVnd: number;

  @ApiProperty({
    type: Number,
    description: 'Cashback left after the refunds clawed their share back.',
  })
  cashbackVnd: number;

  @ApiPropertyOptional({ type: Number })
  originalCommissionVnd?: number | null;

  @ApiPropertyOptional({ type: Number })
  commissionVnd?: number | null;
}

export class AdminOrderDetailDto {
  @ApiProperty({ type: Number })
  id: number;

  @ApiPropertyOptional({ type: Number })
  subtotalVndPrice?: number;

  @ApiPropertyOptional({ type: Number })
  payableVndPrice?: number;

  @ApiPropertyOptional({ type: Number })
  refundedAmountVnd?: number;

  @ApiPropertyOptional({ type: String })
  refundStatus?: string | null;

  @ApiPropertyOptional({ type: () => AdminOrderAfterRefundDto })
  afterRefund?: AdminOrderAfterRefundDto;

  @ApiProperty({ type: Number })
  userId: number;

  @ApiPropertyOptional({ type: () => AdminOrderUserDto })
  user?: AdminOrderUserDto | null;

  @ApiProperty({ type: String })
  orderNumber: string;

  @ApiProperty({ type: String })
  status: string;

  @ApiProperty({
    type: String,
    example: 'BUY_NEW',
    enum: ['BUY_NEW', 'TOPUP'],
  })
  orderType: string;

  /** Everything about the topup; null on an ordinary order (#015). */
  @ApiPropertyOptional({ type: () => AdminOrderTopupDto, nullable: true })
  topup?: AdminOrderTopupDto | null;

  @ApiProperty({ type: Number })
  totalAmount: number;

  @ApiProperty({ type: String })
  currency: string;

  @ApiPropertyOptional({ type: String })
  paymentMethod?: string | null;

  @ApiPropertyOptional({ type: String })
  paymentId?: string | null;

  @ApiPropertyOptional({ type: String })
  couponCode?: string | null;

  @ApiPropertyOptional({ type: String })
  referralCode?: string | null;

  @ApiProperty({ type: Number })
  referralDiscountVndAmount: number;

  @ApiPropertyOptional({ type: () => AdminOrderPartnerCommissionDto })
  partnerCommission?: AdminOrderPartnerCommissionDto | null;

  /**
   * Set when this affiliate order came from the same device or network as
   * another one for the same partner (#036). The commission still stands; the
   * flag is there so an admin can review that partner's other transactions.
   */
  @ApiPropertyOptional({ type: String, example: 'same_device_or_ip' })
  attributionWarning?: string | null;

  @ApiProperty({ type: Number })
  discountAmount: number;

  @ApiProperty({ type: Number })
  couponDiscountVndAmount: number;

  @ApiProperty({ type: Number })
  vndPrice: number;

  @ApiProperty({ type: Number })
  vndCostPrice: number;

  @ApiProperty({ type: Number, example: 50000 })
  walletSpentVndAmount: number;

  @ApiProperty({ type: Number, example: 10000 })
  cashbackAmountVnd: number;

  @ApiPropertyOptional({ type: () => Coupon })
  coupon?: Coupon | null;

  @ApiProperty({ type: () => [AdminOrderItemDto] })
  items: AdminOrderItemDto[];

  @ApiPropertyOptional({
    type: () => AdminOrderInvoiceDto,
    nullable: true,
    description:
      'Invoice request attached to this order (1:1). Null when the customer did not request a financial invoice.',
  })
  invoice?: AdminOrderInvoiceDto | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
