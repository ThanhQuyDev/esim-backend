import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PartnersService } from './partners.service';
import {
  PartnerDepositModeEnum,
  PartnerDepositRequestStatusEnum,
  PartnerTopupMethodEnum,
  PartnerTypeEnum,
} from './partners.enum';

/**
 * "Nạp tiền thủ công" / "Nạp tiền tự động" (vande #068/#069).
 *
 * A company pays its ký quỹ from its own bank account, which SePay and OnePay
 * never see: it reports the transfer with proof and an admin confirms it. A
 * partner on automatic top-ups keeps the QR / card flow, credited by itself.
 */

const PROOF = {
  originalname: 'uy-nhiem-chi.png',
  mimetype: 'image/png',
  size: 2048,
  buffer: Buffer.from('png'),
} as Express.Multer.File;

function buildService(partner: Record<string, unknown>) {
  const saved: Record<string, unknown>[] = [];
  const depositRequestRepository = {
    create: (row: Record<string, unknown>) => row,
    save: jest.fn((row: Record<string, unknown>) => {
      saved.push(row);
      return Promise.resolve({ id: 41, ...row });
    }),
    findOne: jest.fn(),
  };
  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    depositRequestRepository,
    getPartnerOrThrowById: jest.fn().mockResolvedValue({
      id: 11,
      partnerType: PartnerTypeEnum.DISTRIBUTION,
      noDepositRequired: false,
      depositMode: PartnerDepositModeEnum.MANUAL,
      ...partner,
    }),
    configService: { get: () => ({ accountNumber: '123' }) },
  });
  return { service, saved, depositRequestRepository };
}

describe('manual ký quỹ top-ups (vande #068/#069)', () => {
  const cwd = process.cwd();
  let dir: string;

  beforeAll(async () => {
    // The proof is written under ./private; keep it out of the repo.
    dir = await mkdtemp(join(tmpdir(), 'manual-deposit-'));
    process.chdir(dir);
  });

  afterAll(async () => {
    process.chdir(cwd);
    await rm(dir, { recursive: true, force: true });
  });

  it('should record what was paid, the memo and the proof, and wait for an admin', async () => {
    const { service, saved } = buildService({});

    const request = await service.createManualDepositRequest(
      11,
      {
        amountVnd: 50_000_000,
        transferContent: ' CTY HOANG HA NAP KY QUY ',
        note: 'Chuyển từ Techcombank',
      },
      [PROOF],
    );

    expect(request.status).toBe(PartnerDepositRequestStatusEnum.PENDING);
    expect(saved[0]).toMatchObject({
      partnerId: 11,
      amountVnd: 50_000_000,
      creditedVnd: 50_000_000,
      feeVnd: 0,
      method: PartnerTopupMethodEnum.MANUAL_TRANSFER,
      transferContent: 'CTY HOANG HA NAP KY QUY',
      partnerNote: 'Chuyển từ Techcombank',
    });
    const proofs = saved[0].proofFiles as { id: string; name: string }[];
    expect(proofs).toHaveLength(1);
    expect(proofs[0].id).toMatch(/^[a-f0-9]{24}\.png$/);
    expect(proofs[0].name).toBe('uy-nhiem-chi.png');
  });

  it('should refuse a request without proof', async () => {
    const { service } = buildService({});

    await expect(
      service.createManualDepositRequest(
        11,
        { amountVnd: 1_000_000, transferContent: 'NAP KY QUY' },
        [],
      ),
    ).rejects.toThrow('bằng chứng chuyển tiền');
  });

  it('should refuse a proof that is not an image or a PDF', async () => {
    const { service } = buildService({});

    await expect(
      service.createManualDepositRequest(
        11,
        { amountVnd: 1_000_000, transferContent: 'NAP KY QUY' },
        [
          {
            ...PROOF,
            originalname: 'a.exe',
            mimetype: 'application/x-msdownload',
          },
        ],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should send a partner on automatic top-ups back to the QR and card', async () => {
    const { service } = buildService({
      depositMode: PartnerDepositModeEnum.AUTO,
    });

    await expect(
      service.createManualDepositRequest(
        11,
        { amountVnd: 1_000_000, transferContent: 'NAP KY QUY' },
        [PROOF],
      ),
    ).rejects.toThrow('tự động');
  });

  it('should not open a QR or card payment for a partner on manual top-ups', async () => {
    const { service } = buildService({});
    Object.assign(service, {
      depositLimitsFor: jest
        .fn()
        .mockResolvedValue({ minVnd: 0, maxVnd: 1e12 }),
    });

    await expect(
      service.createDepositRequest(11, { amountVnd: 1_000_000 }),
    ).rejects.toThrow('thủ công');
  });

  it('should never let SePay credit a manual top-up', async () => {
    const { service, depositRequestRepository } = buildService({});
    const pending = {
      id: 41,
      status: PartnerDepositRequestStatusEnum.PENDING,
      method: PartnerTopupMethodEnum.MANUAL_TRANSFER,
    };
    depositRequestRepository.findOne.mockResolvedValue(pending);
    const credit = jest.fn();
    Object.assign(service, { creditDepositRequest: credit });

    const result = await service.confirmDepositRequestBySePay(41, 'sp-1');

    expect(result).toBe(pending);
    expect(credit).not.toHaveBeenCalled();
  });

  it('should show a partner only their own proof', async () => {
    const { service, depositRequestRepository } = buildService({});
    depositRequestRepository.findOne.mockResolvedValue({
      id: 41,
      partnerId: 11,
      proofFiles: [{ id: 'a'.repeat(24) + '.png', name: 'x.png' }],
    });

    await expect(
      service.readDepositProof(41, 'a'.repeat(24) + '.png', 12),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.readDepositProof(41, '../../etc/passwd', 11),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
