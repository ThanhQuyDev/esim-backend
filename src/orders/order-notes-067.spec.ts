import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';

/**
 * "Ghi chú" on an order and the refund notes that were saved but shown
 * nowhere (doitac-1410 #067).
 */

function buildService(order: Record<string, unknown> | null = { id: 5 }) {
  const query = jest.fn().mockImplementation((sql: string) => {
    if (sql.includes('INSERT INTO order_note')) {
      return Promise.resolve([{ id: 1, orderId: 5, body: 'x' }]);
    }
    if (sql.includes('FROM order_note')) {
      return Promise.resolve([
        { id: '2', body: 'Khách gọi hotline', createdAt: new Date(), by: null },
      ]);
    }
    if (sql.includes('FROM order_refund')) {
      return Promise.resolve([
        {
          id: '19',
          createdAt: new Date(),
          mode: 'wallet',
          amountVnd: '163000',
          esimCount: '1',
          reason: 'eSIM lỗi',
          adminNote: 'Đã xác minh với nhà mạng',
          by: 'Admin Local',
        },
      ]);
    }
    return Promise.resolve([]);
  });
  const service = Object.create(OrdersService.prototype) as OrdersService;
  Object.assign(service, {
    dataSource: { query },
    orderRepository: { findById: jest.fn().mockResolvedValue(order) },
  });
  return { service, query };
}

describe('OrdersService.addOrderNote (doitac-1410 #067)', () => {
  it('should keep the note with the admin who wrote it', async () => {
    const { service, query } = buildService();

    await service.addOrderNote(5, '  Khách gọi hotline  ', 1);

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO order_note');
    expect(params).toEqual([5, 1, 'Khách gọi hotline']);
  });

  it('should refuse an empty note', async () => {
    const { service } = buildService();

    await expect(service.addOrderNote(5, ' ', 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should refuse a note on an order that does not exist', async () => {
    const { service } = buildService(null);

    await expect(service.addOrderNote(99, 'Ghi chú', 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('order notes and refunds on the detail (doitac-1410 #067)', () => {
  it('should hand back each refund with its reason and admin note', async () => {
    const { service } = buildService();

    const { notes, refunds } = await (
      service as unknown as {
        orderNotesAndRefunds: (id: number) => Promise<{
          notes: { by: string }[];
          refunds: Record<string, unknown>[];
        }>;
      }
    ).orderNotesAndRefunds(5);

    expect(notes[0].by).toBe('Admin');
    expect(refunds[0]).toEqual(
      expect.objectContaining({
        amountVnd: 163000,
        esimCount: 1,
        reason: 'eSIM lỗi',
        adminNote: 'Đã xác minh với nhà mạng',
      }),
    );
  });
});
