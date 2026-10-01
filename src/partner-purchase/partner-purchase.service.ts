import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OrdersService } from '../orders/orders.service';
import { PartnersService } from '../partners/partners.service';

/**
 * Đối tác phân phối tự đặt mua hàng, trả bằng ví ký quỹ (#046).
 *
 * Nằm ở module riêng chứ không nằm trong `PartnersService`, vì luồng này cần
 * `OrdersService` mà `OrdersModule` lại đã import `PartnersModule` — gọi ngược
 * sẽ khép vòng. Module này là lá: nó import cả hai, không ai import nó.
 *
 * Thứ tự các bước được chọn theo hướng "mất hàng còn hơn mất tiền của đối tác":
 * trừ ví TRƯỚC khi gọi nhà cung cấp, và hoàn ngay nếu không cấp được eSIM nào.
 * Làm ngược lại — cấp eSIM rồi mới trừ — để lại khả năng đối tác nhận hàng mà
 * ví không đủ tiền để trừ.
 */
@Injectable()
export class PartnerPurchaseService {
  private readonly logger = new Logger(PartnerPurchaseService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly partnersService: PartnersService,
    private readonly ordersService: OrdersService,
  ) {}

  /**
   * Đặt mua `quantity` eSIM của một gói.
   *
   * Không có trần số lượng (chốt 02/10/2026): số dư ví là ràng buộc duy nhất.
   */
  async purchase(
    partnerId: number,
    input: { planId: number; quantity: number },
  ): Promise<{
    orderNumber: string;
    status: string;
    quantity: number;
    unitPriceVnd: number;
    totalVnd: number;
    listPriceVnd: number;
    marginVnd: number;
    esimCount: number;
  }> {
    const partner = await this.partnersService.getPartnerOrThrowById(partnerId);

    // Báo giá đi qua đúng hàm mà màn hình đã gọi để hiện số, nên con số đối
    // tác nhìn thấy lúc bấm và con số bị trừ không thể lệch nhau.
    const quote = await this.partnersService.quotePurchase(
      partnerId,
      input.planId,
      input.quantity,
    );
    if (quote.rejection) {
      throw new BadRequestException(quote.rejection);
    }

    const plan = await this.dataSource.query(
      `SELECT id, slug, "providerPlanId", currency FROM plan
        WHERE id = $1 AND "isActive" = true AND "deletedAt" IS NULL`,
      [input.planId],
    );
    if (!plan.length) {
      throw new NotFoundException('Không tìm thấy gói này.');
    }

    const order = await this.ordersService.submitPartnerPurchase({
      buyerUserId: partner.userId,
      planId: input.planId,
      quantity: quote.quantity,
      // Đơn ghi đúng số tiền đối tác trả, không phải giá bán lẻ: nếu ghi giá
      // niêm yết thì mọi báo cáo doanh thu của esim.vn sẽ cộng thêm phần tiền
      // chưa ai trả.
      unitPriceVnd: quote.unitPriceVnd,
      onDebit: async (orderId, orderNumber) => {
        await this.partnersService.debitWalletForPurchase(partnerId, {
          orderId,
          orderNumber,
          amountVnd: quote.totalVnd,
          reason: `Mua ${quote.quantity} eSIM — đơn ${orderNumber}`,
        });
      },
    });

    const esimCount = await this.countEsims(order.id);

    // Không cấp được eSIM nào: hoàn nguyên tiền thay vì để đối tác mất tiền
    // chờ người xử lý. Cấp thiếu một phần thì giữ nguyên và để đối tác báo
    // từng eSIM lỗi — admin duyệt tay, theo quyết định A4.
    if (esimCount === 0) {
      await this.partnersService.refundWalletForPurchase(partnerId, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        amountVnd: quote.totalVnd,
        suffix: 'provisioning-failed',
        reason: `Hoàn tiền: đơn ${order.orderNumber} không cấp được eSIM nào`,
      });
      this.logger.error(
        `purchase: order ${order.orderNumber} provisioned 0 eSIMs, refunded ${quote.totalVnd}đ to partner ${partnerId}`,
      );
      throw new BadRequestException(
        `Nhà cung cấp chưa cấp được eSIM cho đơn này. Tiền đã được hoàn lại ví, bạn có thể thử lại hoặc chọn gói khác.`,
      );
    }

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      quantity: quote.quantity,
      unitPriceVnd: quote.unitPriceVnd,
      totalVnd: quote.totalVnd,
      listPriceVnd: quote.listTotalVnd,
      marginVnd: quote.marginVnd,
      esimCount,
    };
  }

  /**
   * Đối tác tự huỷ đơn của mình (quyết định A5).
   *
   * Chỉ huỷ được khi **chưa có eSIM nào** được cấp: eSIM đã cấp là hàng đã
   * giao, đối tác có thể đã bán đi rồi. Trường hợp đó đi đường báo lỗi và
   * admin duyệt tay.
   */
  async cancelPurchase(
    partnerId: number,
    orderNumber: string,
  ): Promise<{ orderNumber: string; refundedVnd: number }> {
    const partner = await this.partnersService.getPartnerOrThrowById(partnerId);

    const rows = await this.dataSource.query(
      `SELECT id, status FROM "order"
        WHERE "orderNumber" = $1 AND "userId" = $2 AND "deletedAt" IS NULL`,
      [orderNumber, partner.userId],
    );
    if (!rows.length) {
      throw new NotFoundException(`Không tìm thấy đơn ${orderNumber}.`);
    }
    const order = rows[0] as { id: number; status: string };

    const esimCount = await this.countEsims(order.id);
    if (esimCount > 0) {
      throw new BadRequestException(
        `Đơn ${orderNumber} đã cấp ${esimCount} eSIM nên không tự huỷ được. Nếu eSIM lỗi, hãy báo lỗi để esim.vn kiểm tra và hoàn tiền.`,
      );
    }

    const spent = await this.dataSource.query(
      `SELECT COALESCE(-SUM("amountVnd"), 0)::bigint AS "costVnd"
         FROM partner_wallet_transaction
        WHERE "orderId" = $1 AND type IN ('order_purchase', 'order_purchase_reversal')`,
      [order.id],
    );
    const refundedVnd = Number(spent[0]?.costVnd ?? 0);

    await this.ordersService.cancelOrder(order.id, partner.userId);

    if (refundedVnd > 0) {
      await this.partnersService.refundWalletForPurchase(partnerId, {
        orderId: order.id,
        orderNumber,
        amountVnd: refundedVnd,
        suffix: 'cancelled',
        reason: `Hoàn tiền: đối tác huỷ đơn ${orderNumber}`,
      });
    }

    return { orderNumber, refundedVnd };
  }

  private async countEsims(orderId: number): Promise<number> {
    const rows = await this.dataSource.query(
      `SELECT count(*)::int AS n
         FROM esim e
         JOIN order_item oi ON oi.id = e."orderItemId"
        WHERE oi."orderId" = $1`,
      [orderId],
    );
    return Number(rows[0]?.n ?? 0);
  }
}
