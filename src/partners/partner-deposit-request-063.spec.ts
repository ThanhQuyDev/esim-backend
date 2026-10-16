import { BadRequestException } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PartnerDepositRequestStatusEnum } from './partners.enum';

/**
 * "Yêu cầu nạp ký quỹ" as a list, with "Từ chối" (doitac-1410 #063).
 */

describe('PartnersService.adminListDepositRequests (doitac-1410 #063)', () => {
  function buildService(rows: Record<string, unknown>[] = []) {
    const query = jest.fn().mockResolvedValue(rows);
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, { dataSource: { query } });
    return { service, query };
  }

  it('should name the partner, a company by the company', async () => {
    const { service, query } = buildService([
      {
        id: '3',
        partnerId: '4',
        amountVnd: '1000000',
        feeVnd: '0',
        creditedVnd: null,
        partnerName: 'Công ty TNHH ETELECOM',
        contactName: 'Nguyễn Văn Nam',
      },
    ]);

    const [row] = await service.adminListDepositRequests({});

    expect(row).toMatchObject({
      id: 3,
      partnerId: 4,
      partnerName: 'Công ty TNHH ETELECOM',
      creditedVnd: 1000000,
    });
    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain(`p."legalType" = 'company'`);
  });

  it('should read a short number as the partner ID', async () => {
    const { service, query } = buildService();

    await service.adminListDepositRequests({ search: '6' });

    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params.slice(0, 3)).toEqual([null, 6, null]);
  });

  it('should search name, email and the transfer code as text', async () => {
    const { service, query } = buildService();

    await service.adminListDepositRequests({
      search: 'ESIMUM74M9',
      status: 'pending',
    });

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params.slice(0, 3)).toEqual(['pending', null, 'ESIMUM74M9']);
    expect(sql).toContain('r."bankTransferCode" ILIKE');
    expect(sql).toContain('p."contactEmail" ILIKE');
  });

  it('should read "all" as no status filter', async () => {
    const { service, query } = buildService();

    await service.adminListDepositRequests({ status: 'all' });

    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params[0]).toBeNull();
  });
});

describe('PartnersService.rejectDepositRequest (doitac-1410 #063)', () => {
  function buildService(status: PartnerDepositRequestStatusEnum) {
    const request = { id: 2, partnerId: 6, status, amountVnd: 500000 };
    const depositRequestRepository = {
      findOne: jest.fn().mockResolvedValue(request),
      save: jest.fn().mockImplementation((r) => Promise.resolve(r)),
    };
    const createWalletTransaction = jest.fn();
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      depositRequestRepository,
      createWalletTransaction,
    });
    return { service, createWalletTransaction };
  }

  it('should refuse with the reason and credit nothing', async () => {
    const { service, createWalletTransaction } = buildService(
      PartnerDepositRequestStatusEnum.PENDING,
    );

    const saved = await service.rejectDepositRequest(
      2,
      '  Không nhận được tiền chuyển khoản  ',
      1,
    );

    expect(saved).toMatchObject({
      status: 'rejected',
      rejectionReason: 'Không nhận được tiền chuyển khoản',
      rejectedByAdminId: 1,
    });
    expect(saved.rejectedAt).toBeInstanceOf(Date);
    expect(createWalletTransaction).not.toHaveBeenCalled();
  });

  it('should demand a reason the partner can read', async () => {
    const { service } = buildService(PartnerDepositRequestStatusEnum.PENDING);

    await expect(service.rejectDepositRequest(2, 'sai', 1)).rejects.toThrow(
      'lý do từ chối',
    );
  });

  it('should not undo a confirmed request', async () => {
    const { service } = buildService(PartnerDepositRequestStatusEnum.CONFIRMED);

    await expect(
      service.rejectDepositRequest(2, 'Không nhận được tiền', 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should not confirm one already refused', async () => {
    const { service, createWalletTransaction } = buildService(
      PartnerDepositRequestStatusEnum.REJECTED,
    );

    await expect(service.confirmDepositRequest(2, 1)).rejects.toThrow(
      'đã được xử lý',
    );
    expect(createWalletTransaction).not.toHaveBeenCalled();
  });
});
