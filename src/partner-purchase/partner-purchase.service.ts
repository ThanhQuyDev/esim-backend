import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OrdersService } from '../orders/orders.service';
import { PartnersService } from '../partners/partners.service';
import { TopupService } from '../topup/topup.service';

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
    private readonly topupService: TopupService,
  ) {}

  /**
   * "Gửi lại email eSIM" from one eSIM's page (doitac-1410 #039): that eSIM
   * only, to the order's delivery email when the partner set one, else to
   * the partner's own address — the same rule as the first send (#034).
   */
  async resendEsimEmail(
    partnerId: number,
    iccid: string,
  ): Promise<{ sent: number }> {
    const { orderId } = await this.partnersService.assertOwnsEsim(
      partnerId,
      iccid,
    );
    const result = await this.ordersService.resendEsimEmail(orderId, {
      onlyIccid: iccid,
    });
    if (!result.sent) {
      throw new BadRequestException(
        'Chưa gửi được email: eSIM chưa được cấp hoặc đơn chưa có email nhận.',
      );
    }
    return { sent: result.sent };
  }

  /**
   * Topup packages this eSIM can take, at the partner's agent price
   * (doitac-1410 #039) — cost + tier markup, the same rule as a new eSIM.
   */
  async listTopupPackages(partnerId: number, iccid: string) {
    await this.partnersService.assertOwnsEsim(partnerId, iccid);
    const { packages } = await this.topupService.listPackagesWithCost(iccid);
    return Promise.all(
      packages.map(async (pkg) => {
        const agentPriceVnd =
          pkg.costVnd > 0
            ? await this.partnersService.partnerAgentPriceVnd(
                partnerId,
                pkg.costVnd,
              )
            : 0;
        // No supplier cost or provider id leaves the server.
        return {
          packageId: pkg.packageId,
          name: pkg.name,
          dataText: pkg.dataAmountText,
          durationDays: pkg.durationDays,
          isUnlimited: pkg.isUnlimited,
          agentPriceVnd,
          retailPriceVnd: Number(pkg.vndPrice ?? 0),
          purchasable: agentPriceVnd > 0,
        };
      }),
    );
  }

  /**
   * "Topup hộ khách" (doitac-1410 #039): pay from the deposit wallet, then
   * recharge. The debit happens before the supplier is called, like a
   * purchase; a supplier failure leaves the order in manual intervention for
   * esim.vn to finish or refund.
   */
  async topupEsim(
    partnerId: number,
    iccid: string,
    packageId: string,
  ): Promise<{ orderNumber: string; status: string; amountVnd: number }> {
    await this.partnersService.assertOwnsEsim(partnerId, iccid);
    const partner = await this.partnersService.getPartnerOrThrowById(partnerId);
    return this.topupService.checkoutForPartner(
      partner.userId,
      { iccid, packageId },
      (costVnd) =>
        this.partnersService.partnerAgentPriceVnd(partnerId, costVnd),
      async (order, amountVnd) => {
        const rejection =
          await this.partnersService.partnerWalletPaymentRejection(
            partnerId,
            amountVnd,
          );
        if (rejection) throw new BadRequestException(rejection);
        await this.partnersService.debitWalletForPurchase(partnerId, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          amountVnd,
          reason: `Topup eSIM ${iccid} – đơn ${order.orderNumber}`,
        });
      },
    );
  }

  /**
   * Đặt mua `quantity` eSIM của một gói.
   *
   * Không có trần số lượng (chốt 02/10/2026): số dư ví là ràng buộc duy nhất.
   */
  async purchase(
    partnerId: number,
    input: {
      planId: number;
      quantity: number;
      /** The customer the QR codes are emailed to (doitac-1410 #034). */
      recipientEmail?: string | null;
    },
  ): Promise<{
    orderNumber: string;
    status: string;
    quantity: number;
    unitPriceVnd: number;
    totalVnd: number;
    listPriceVnd: number;
    marginVnd: number;
    esimCount: number;
    pendingEsims: number;
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
      deliveryEmail: input.recipientEmail?.trim().toLowerCase() || null,
      onDebit: async (orderId, orderNumber) => {
        await this.partnersService.debitWalletForPurchase(partnerId, {
          orderId,
          orderNumber,
          amountVnd: quote.totalVnd,
          reason: `Mua ${quote.quantity} eSIM — đơn ${orderNumber}`,
        });
      },
    });

    const state = await this.provisioningState(order.id);

    // Chỉ hoàn tiền khi nhà cung cấp KHÔNG nhận đơn (doitac-1410 #006).
    //
    // Trước đây đếm eSIM ngay sau khi gửi đơn, và 0 eSIM là hoàn tiền. Nhưng
    // Airalo, eSIM Access, MicroEsim, Billion, Gadget Korea đều trả eSIM sau,
    // qua webhook: đơn đã đặt và esim.vn đã trả tiền nhà cung cấp, đối tác vẫn
    // được hoàn — và khi eSIM về thì đối tác cầm eSIM miễn phí (đơn
    // PTN-261014031301833 trên beta: 3 eSIM Airalo, ví được hoàn 324.000đ).
    // Giờ đơn nhà cung cấp đã nhận là đơn đang chờ cấp; chỉ đơn bị từ chối
    // ngay (không có mã đơn nhà cung cấp, không có eSIM) mới được hoàn.
    if (state.esims === 0 && state.waitingItems === 0) {
      await this.partnersService.refundWalletForPurchase(partnerId, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        amountVnd: quote.totalVnd,
        suffix: 'provisioning-failed',
        reason: `Hoàn tiền: đơn ${order.orderNumber} không cấp được eSIM nào`,
      });
      // Đơn đã hoàn tiền thì không được nằm ở "đã thanh toán".
      await this.dataSource.query(
        `UPDATE "order" SET status = 'failed' WHERE id = $1`,
        [order.id],
      );
      this.logger.error(
        `purchase: order ${order.orderNumber} rejected by the provider, refunded ${quote.totalVnd}đ to partner ${partnerId}`,
      );
      throw new BadRequestException(
        `Nhà cung cấp chưa nhận đơn này. Tiền đã được hoàn lại ví, bạn có thể thử lại hoặc chọn gói khác.`,
      );
    }

    const esimCount = state.esims;

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      quantity: quote.quantity,
      unitPriceVnd: quote.unitPriceVnd,
      totalVnd: quote.totalVnd,
      listPriceVnd: quote.listTotalVnd,
      marginVnd: quote.marginVnd,
      esimCount,
      /** eSIM nhà cung cấp còn đang cấp; hiện dần trong Quản lý eSIM. */
      pendingEsims: Math.max(0, quote.quantity - esimCount),
    };
  }

  /**
   * Thanh toán cả giỏ hàng trong MỘT đơn (doitac-1410 #035): trừ ví đúng tổng
   * đã báo, rồi gửi từng dòng cho nhà cung cấp của nó. Dòng nào bị từ chối
   * ngay (không có mã đơn nhà cung cấp, không có eSIM) được hoàn đúng phần
   * tiền của dòng đó; cả đơn không cấp được gì thì hoàn hết.
   */
  async purchaseCart(
    partnerId: number,
    input: {
      items: { planId: number; quantity: number }[];
      recipientEmail?: string | null;
    },
  ): Promise<{
    orderNumber: string;
    status: string;
    planCount: number;
    quantity: number;
    totalVnd: number;
    refundedVnd: number;
    esimCount: number;
    pendingEsims: number;
  }> {
    const partner = await this.partnersService.getPartnerOrThrowById(partnerId);
    const quote = await this.partnersService.quoteCart(partnerId, input.items);
    if (quote.rejection) {
      throw new BadRequestException(quote.rejection);
    }

    const order = await this.ordersService.submitPartnerPurchase({
      buyerUserId: partner.userId,
      planId: quote.lines[0].planId,
      quantity: quote.lines[0].quantity,
      unitPriceVnd: quote.lines[0].unitPriceVnd,
      items: quote.lines.map((l) => ({
        planId: l.planId,
        quantity: l.quantity,
        unitPriceVnd: l.unitPriceVnd,
      })),
      deliveryEmail: input.recipientEmail?.trim().toLowerCase() || null,
      onDebit: async (orderId, orderNumber) => {
        await this.partnersService.debitWalletForPurchase(partnerId, {
          orderId,
          orderNumber,
          amountVnd: quote.totalVnd,
          reason: `Mua ${quote.esimCount} eSIM (${quote.planCount} gói) — đơn ${orderNumber}`,
        });
      },
    });

    // Lines the supplier turned down on the spot.
    const items: {
      id: number;
      planId: number;
      quantity: number;
      orderRequestId: string | null;
      n: number;
    }[] = await this.dataSource.query(
      `SELECT oi.id, oi."planId", oi.quantity, oi."orderRequestId",
              (SELECT count(*) FROM esim e WHERE e."orderItemId" = oi.id)::int AS n
         FROM order_item oi WHERE oi."orderId" = $1`,
      [order.id],
    );
    const failed = items.filter((i) => i.n === 0 && !i.orderRequestId);
    const priceOf = new Map(quote.lines.map((l) => [l.planId, l.unitPriceVnd]));
    const refundedVnd = failed.reduce(
      (sum, i) =>
        sum + (priceOf.get(Number(i.planId)) ?? 0) * Number(i.quantity),
      0,
    );
    const esimCount = items.reduce((sum, i) => sum + Number(i.n), 0);

    if (failed.length === items.length) {
      await this.partnersService.refundWalletForPurchase(partnerId, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        amountVnd: quote.totalVnd,
        suffix: 'provisioning-failed',
        reason: `Hoàn tiền: đơn ${order.orderNumber} không cấp được eSIM nào`,
      });
      await this.dataSource.query(
        `UPDATE "order" SET status = 'failed' WHERE id = $1`,
        [order.id],
      );
      throw new BadRequestException(
        'Nhà cung cấp chưa nhận đơn này. Tiền đã được hoàn lại ví, bạn có thể thử lại hoặc chọn gói khác.',
      );
    }
    if (refundedVnd > 0) {
      await this.partnersService.refundWalletForPurchase(partnerId, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        amountVnd: refundedVnd,
        suffix: `lines-failed:${failed.map((i) => i.id).join('-')}`,
        reason: `Hoàn tiền: ${failed.length} gói trong đơn ${order.orderNumber} không cấp được eSIM`,
      });
      for (const item of failed) {
        await this.dataSource.query(
          `UPDATE order_item SET status = 'failed' WHERE id = $1`,
          [item.id],
        );
      }
    }

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      planCount: quote.planCount,
      quantity: quote.esimCount,
      totalVnd: quote.totalVnd - refundedVnd,
      refundedVnd,
      esimCount,
      pendingEsims: Math.max(
        0,
        quote.esimCount -
          esimCount -
          failed.reduce((sum, i) => sum + Number(i.quantity), 0),
      ),
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

    const state = await this.provisioningState(order.id);
    const esimCount = state.esims;
    // Nhà cung cấp đã nhận đơn thì esim.vn đã trả tiền và eSIM đang về: huỷ
    // lúc này là đối tác lấy lại tiền rồi vẫn nhận eSIM (doitac-1410 #006).
    if (state.waitingItems > 0) {
      throw new BadRequestException(
        `Đơn ${orderNumber} đã được nhà cung cấp tiếp nhận, eSIM đang được cấp nên không huỷ được. Nếu sau ít phút vẫn chưa có eSIM, hãy liên hệ esim.vn.`,
      );
    }
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

  /**
   * Tình trạng cấp eSIM của một đơn: bao nhiêu eSIM đã về, bao nhiêu dòng nhà
   * cung cấp đã nhận (có mã đơn bên họ) mà eSIM chưa về, bao nhiêu dòng bị từ
   * chối ngay (doitac-1410 #006).
   */
  private async provisioningState(orderId: number): Promise<{
    esims: number;
    waitingItems: number;
    failedItems: number;
  }> {
    const rows = await this.dataSource.query(
      `SELECT COALESCE(SUM(x.n), 0)::int AS esims,
              COUNT(*) FILTER (
                WHERE x.n = 0 AND x."orderRequestId" IS NOT NULL
              )::int AS "waitingItems",
              COUNT(*) FILTER (
                WHERE x.n = 0 AND x."orderRequestId" IS NULL
              )::int AS "failedItems"
         FROM (
           SELECT oi."orderRequestId",
                  (SELECT count(*) FROM esim e WHERE e."orderItemId" = oi.id) AS n
             FROM order_item oi
            WHERE oi."orderId" = $1
         ) x`,
      [orderId],
    );
    return {
      esims: Number(rows[0]?.esims ?? 0),
      waitingItems: Number(rows[0]?.waitingItems ?? 0),
      failedItems: Number(rows[0]?.failedItems ?? 0),
    };
  }
}
