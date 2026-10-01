import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Order } from '../../domain/order';
import { FilterOrderDto, SortOrderDto } from '../../dto/query-order.dto';

export interface ReconciliationExportRow {
  /** Groups the lines of one order, for the order-level columns below (#018). */
  orderId: number;
  orderNumber: string;
  orderStatus: string;
  orderCreatedAt: Date;
  customerEmail: string | null;
  provider: string | null;
  planName: string | null;
  providerPlanId: string | null;
  providerOrderRef: string | null;
  itemStatus: string;
  quantity: number;
  vndCostPrice: number;
  vndPrice: number;
  iccids: string | null;

  /**
   * Order-level fields (#018). They belong to the ORDER, not the line, so the
   * export writes each of them once per order — on its first line — and leaves
   * them blank on the rest. Repeating them would make a plain SUM over the
   * column count a three-line order's discount three times.
   */
  orderType: string | null;
  paymentMethod: string | null;
  couponCode: string | null;
  referralCode: string | null;
  couponDiscountVndAmount: number;
  referralDiscountVndAmount: number;
  cashbackAmountVnd: number;
  walletSpentVndAmount: number;
  /** Affiliate behind the order, when there is one. */
  partnerName: string | null;
  partnerCommissionVnd: number;
  /** Invoice request attached to the order, when the customer asked for one. */
  invoiceStatus: string | null;
  invoiceCompanyName: string | null;
  invoiceTaxCode: string | null;
}

export abstract class OrderRepository {
  abstract create(data: Partial<Order>): Promise<Order>;

  abstract findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterOrderDto | null;
    sortOptions?: SortOrderDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[Order[], number]>;

  /**
   * Flat, unpaginated rows for the supplier-reconciliation export (#028):
   * ONE ROW PER ORDER ITEM, because debt is settled per supplier and a single
   * order can mix three of them.
   */
  abstract findAllForReconciliationExport(
    filterOptions?: FilterOrderDto | null,
  ): Promise<ReconciliationExportRow[]>;

  abstract findById(id: Order['id']): Promise<NullableType<Order>>;

  abstract findByOrderNumber(orderNumber: string): Promise<NullableType<Order>>;

  abstract findByBankTransferCode(
    bankTransferCode: string,
  ): Promise<NullableType<Order>>;

  abstract findByOrderNumberAndUserId(
    orderNumber: string,
    userId: number,
  ): Promise<NullableType<Order>>;

  abstract update(
    id: Order['id'],
    payload: DeepPartial<Order>,
  ): Promise<Order | null>;

  abstract remove(id: Order['id']): Promise<void>;

  abstract failExpiredPendingOrders(
    minutesThreshold: number,
  ): Promise<number[]>;

  abstract softDeleteByStatusOlderThan(
    status: string,
    olderThanDays: number,
  ): Promise<number>;
}
