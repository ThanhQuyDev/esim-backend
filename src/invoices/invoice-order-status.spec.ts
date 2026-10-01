import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';

/**
 * #011 — "Đơn hàng lỗi, đơn hàng hoàn thì ẩn nút bấm xuất hóa đơn."
 *
 * The CMS hides the button; these cover the endpoint, so a stale tab or a direct
 * call cannot issue an invoice for money esim.vn does not hold.
 */
describe('InvoicesService.createForOrder — order status (#011)', () => {
  function setup(
    order: { id: number; status: string; orderNumber?: string } | null,
  ) {
    const created: Record<string, unknown>[] = [];
    const orderService = { findById: jest.fn().mockResolvedValue(order) };
    const invoiceRepository = {
      findByOrderId: jest.fn().mockResolvedValue(null),
      create: jest.fn((payload: Record<string, unknown>) => {
        created.push(payload);
        return Promise.resolve({ id: 1, ...payload });
      }),
    };
    const mailService = { sendInvoiceIssued: jest.fn() };

    const service = new InvoicesService(
      orderService as never,
      invoiceRepository as never,
      mailService as never,
    );
    return { service, created, invoiceRepository };
  }

  const INPUT = {
    companyName: 'Cong ty A',
    taxCode: '0101234567',
    address: 'Ha Noi',
    invoicePhone: '0912345678',
    invoiceEmail: 'ketoan@congtya.vn',
  };

  it.each(['failed', 'refunded', 'cancelled'])(
    'refuses an order with status %s',
    async (status) => {
      const { service, created } = setup({
        id: 7,
        status,
        orderNumber: 'ORD-7',
      });

      await expect(service.createForOrder(7, INPUT)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(created).toHaveLength(0);
    },
  );

  it('should ignores the case of the status', async () => {
    const { service } = setup({
      id: 7,
      status: 'REFUNDED',
      orderNumber: 'ORD-7',
    });

    await expect(service.createForOrder(7, INPUT)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('should still issues for a paid order', async () => {
    const { service, created } = setup({
      id: 7,
      status: 'paid',
      orderNumber: 'ORD-7',
    });

    await service.createForOrder(7, INPUT);

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ orderId: 7, companyName: 'Cong ty A' });
  });

  it('should checks the status before the duplicate check, so a refunded order reports the real reason', async () => {
    const { service, invoiceRepository } = setup({
      id: 7,
      status: 'refunded',
      orderNumber: 'ORD-7',
    });
    invoiceRepository.findByOrderId.mockResolvedValue({ id: 3 });

    await expect(service.createForOrder(7, INPUT)).rejects.not.toBeInstanceOf(
      ConflictException,
    );
  });
});
