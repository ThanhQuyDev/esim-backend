import { UnprocessableEntityException } from '@nestjs/common';
import { InvoicesService, normalizeInvoiceNumber } from './invoices.service';
import { InvoiceStatus } from './invoices.enum';

/**
 * doitac-3010 #044 — "Số hóa đơn VAT": required before an invoice is issued,
 * and any order can get one as a consumer invoice, without company details.
 */
describe('VAT invoice number (doitac-3010 #044)', () => {
  const build = (existing: Record<string, unknown> | null = null) => {
    const service = Object.create(InvoicesService.prototype) as InvoicesService;
    const invoiceRepository = {
      findById: jest.fn().mockResolvedValue(existing),
      findByOrderId: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockImplementation((_id, p) => Promise.resolve(p)),
      create: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    };
    const orderService = {
      findById: jest
        .fn()
        .mockResolvedValue({ id: 9, status: 'paid', orderNumber: 'ORD-1' }),
    };
    Object.assign(service, {
      invoiceRepository,
      orderService,
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      mailService: { sendInvoiceIssued: jest.fn() },
    });
    return { service, invoiceRepository };
  };

  it('should trim the number and read a blank as none', () => {
    expect(normalizeInvoiceNumber(' 0001234 ')).toBe('0001234');
    expect(normalizeInvoiceNumber('   ')).toBeNull();
    expect(normalizeInvoiceNumber(undefined)).toBeNull();
  });

  it('should refuse to issue an invoice without its number', async () => {
    const { service } = build({ id: 'a', status: InvoiceStatus.PENDING });
    await expect(
      service.update('a', { status: InvoiceStatus.ISSUED } as never),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('should issue it with the number', async () => {
    const { service, invoiceRepository } = build({
      id: 'a',
      status: InvoiceStatus.PENDING,
    });
    await service.update('a', {
      status: InvoiceStatus.ISSUED,
      invoiceNumber: ' 0001234 ',
    } as never);
    expect(invoiceRepository.update).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({ status: 'ISSUED', invoiceNumber: '0001234' }),
    );
  });

  it('should issue a consumer invoice with only the number', async () => {
    const { service, invoiceRepository } = build();
    await service.issueConsumerInvoice(9, '0005678');
    expect(invoiceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ISSUED',
        buyerType: 'consumer',
        invoiceNumber: '0005678',
        companyName: '',
      }),
    );
  });

  it('should refuse a consumer invoice without a number', async () => {
    const { service } = build();
    await expect(service.issueConsumerInvoice(9, ' ')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });
});
