import { PartnersService } from './partners.service';

/**
 * doitac-3010 #015 — link codes as an admin types them: from 2 characters,
 * "-", "_" and "." allowed, kept in lower case, and a code any link ever had
 * (a deleted one included) refused in plain Vietnamese.
 */
describe('Link codes an admin creates (doitac-3010 #015)', () => {
  function service(taken: Record<string, unknown> | null) {
    const save = jest.fn((row) => Promise.resolve({ id: 7, ...row }));
    const findOne = jest.fn().mockResolvedValue(taken);
    const svc = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(svc, {
      getPartnerOrThrowById: jest.fn().mockResolvedValue({ id: 9 }),
      linkRepository: { findOne, save, create: (row: unknown) => row },
      logLinkEvent: jest.fn(),
    });
    return { svc, save, findOne };
  }

  it('should keep a short lower-case code with a dot as typed', async () => {
    const { svc, save, findOne } = service(null);
    await svc.adminCreateLinkForPartner(9, { label: 'VIP', code: 'vn.go' });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'vn.go' }),
    );
    // Looked up among deleted links too.
    expect(findOne.mock.calls[0][0]).toMatchObject({ withDeleted: true });
  });

  it('should refuse a deleted link’s name, saying it is kept for ever', async () => {
    const { svc } = service({
      code: 'CUCDULICH',
      status: 'active',
      deletedAt: new Date(),
    });
    await expect(
      svc.adminCreateLinkForPartner(9, { label: 'x', code: 'cucdulich' }),
    ).rejects.toThrow(
      'Link tiếp thị "CUCDULICH" đã tồn tại trên hệ thống và đang ở trạng thái "Đã xóa"',
    );
  });
});
