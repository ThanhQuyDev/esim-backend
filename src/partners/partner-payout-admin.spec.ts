import { BadRequestException } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PartnerPayoutStatusEnum } from './partners.enum';

/**
 * The withdrawal list and its decisions on "Tài chính" (#068, #069, #070).
 *
 * A refusal carries a reason because the partner reads it on their own
 * withdrawal screen; "bị từ chối" with nothing after it is a support ticket,
 * not an answer.
 */

const ROW = {
  id: '4',
  partnerId: '14',
  amountVnd: '2500000',
  status: 'pending',
  adminNote: null,
  createdAt: '2026-09-12T03:00:00.000Z',
  processedAt: null,
  bankAccountInfo: 'Techcombank · 19001234567890 · NGUYEN VAN A',
  contactName: 'Nguyễn Văn A',
  contactEmail: 'a@example.com',
  contactPhone: '0900000001',
  partnerType: 'kol',
  bankName: 'Techcombank',
  bankAccountNumber: '19001234567890',
  bankAccountHolder: 'NGUYEN VAN A',
  bankBranch: 'Chi nhánh Tân Bình',
};

function buildService(rows: Record<string, unknown>[] = [ROW], total = 1) {
  const query = jest
    .fn()
    .mockImplementation((sql: string) =>
      Promise.resolve(sql.includes('COUNT(*)::int') ? [{ total }] : rows),
    );

  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, { dataSource: { query } });
  return { service, query };
}

describe('PartnersService.adminListPayouts (#068, #069)', () => {
  it('should carry the partner behind each request', async () => {
    // A row reading "Đối tác #14" is not something a finance person can act on.
    const { service } = buildService();

    const { data, totalCount } = await service.adminListPayouts({});

    expect(totalCount).toBe(1);
    expect(data[0]).toMatchObject({
      id: 4,
      partnerId: 14,
      contactName: 'Nguyễn Văn A',
      contactEmail: 'a@example.com',
      amountVnd: 2_500_000,
    });
  });

  it('should read the financial period off the month it was asked in', async () => {
    const { service } = buildService();

    const { data } = await service.adminListPayouts({});

    expect(data[0].period).toBe('2026-09');
  });

  it('should show only the last four digits on the list', async () => {
    // The full number belongs in the detail popup, not in a column.
    const { service } = buildService();

    const { data } = await service.adminListPayouts({});

    expect(data[0].bankAccountLast4).toBe('7890');
    expect(data[0].bankAccountNumber).toBe('19001234567890');
    expect(data[0].bankBranch).toBe('Chi nhánh Tân Bình');
  });

  it('should prefer the payout snapshot over the current profile', async () => {
    // An account the partner edits later must not rewrite where money went.
    const { service, query } = buildService();

    await service.adminListPayouts({});

    const sql = (query.mock.calls.find(
      ([q]: [string]) => !q.includes('COUNT(*)::int'),
    ) ?? [])[0] as string;
    expect(sql).toContain(
      'COALESCE(pay."bankAccountNumber", p."bankAccountNumber")',
    );
  });

  it('should take the end of a date range as the whole of that day', async () => {
    const { service, query } = buildService();

    await service.adminListPayouts({
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
    });

    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect((params[4] as Date).getDate()).toBe(1);
    expect((params[4] as Date).getMonth()).toBe(9);
  });

  it('should treat a numeric search as an id as well as text', async () => {
    const { service, query } = buildService();

    await service.adminListPayouts({ search: '#14' });

    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params[1]).toBe('#14');
    expect(params[2]).toBe(14);
  });

  it('should read "all" as no status filter', async () => {
    const { service, query } = buildService();

    await service.adminListPayouts({ status: 'all' });

    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params[0]).toBeNull();
  });
});

describe('PartnersService.rejectPayout (#069)', () => {
  function buildRejectService(payout: Record<string, unknown>) {
    const save = jest.fn().mockImplementation((row) => Promise.resolve(row));
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      payoutRepository: { findOne: jest.fn().mockResolvedValue(payout), save },
    });
    return { service, save };
  }

  it('should refuse a rejection with no reason on it', async () => {
    const { service, save } = buildRejectService({
      id: 4,
      status: PartnerPayoutStatusEnum.PENDING,
    });

    await expect(service.rejectPayout(4, '   ', 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('should keep the reason the partner will read', async () => {
    const { service, save } = buildRejectService({
      id: 4,
      status: PartnerPayoutStatusEnum.PENDING,
    });

    await service.rejectPayout(4, '  Sai số tài khoản thụ hưởng  ', 1);

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: PartnerPayoutStatusEnum.REJECTED,
        adminNote: 'Sai số tài khoản thụ hưởng',
      }),
    );
  });
});

describe('PartnersService.adminBulkPayoutDecision (#069)', () => {
  function buildBulkService() {
    const service = Object.create(PartnersService.prototype) as PartnersService;
    const approvePayout = jest.fn().mockResolvedValue({});
    const rejectPayout = jest.fn().mockResolvedValue({});
    Object.assign(service, { approvePayout, rejectPayout });
    return { service, approvePayout, rejectPayout };
  }

  it('should settle every ticked row in one decision', async () => {
    const { service, approvePayout } = buildBulkService();

    const result = await service.adminBulkPayoutDecision(
      { ids: [4, 7, 4], decision: 'approve' },
      1,
    );

    // The repeated id is one request, not two.
    expect(result.updated).toBe(2);
    expect(approvePayout).toHaveBeenCalledTimes(2);
  });

  it('should refuse a bulk rejection with no reason', async () => {
    const { service, rejectPayout } = buildBulkService();

    await expect(
      service.adminBulkPayoutDecision({ ids: [4], decision: 'reject' }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(rejectPayout).not.toHaveBeenCalled();
  });

  it('should report a row somebody else already handled instead of failing', async () => {
    // Ticking twenty and finding one was settled a minute ago should still
    // settle the other nineteen.
    const { service, approvePayout } = buildBulkService();
    approvePayout.mockImplementation((id: number) =>
      id === 7
        ? Promise.reject(new BadRequestException())
        : Promise.resolve({}),
    );

    const result = await service.adminBulkPayoutDecision(
      { ids: [4, 7, 9], decision: 'approve' },
      1,
    );

    expect(result).toEqual({ updated: 2, skipped: [7] });
  });
});
