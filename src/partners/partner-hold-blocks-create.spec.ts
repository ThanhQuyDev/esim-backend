import { PartnersService } from './partners.service';
import { PartnerStatusEnum, PartnerTypeEnum } from './partners.enum';

/**
 * doitac-3010 #009 — a partner on "Tạm khoá" could still create a link or a
 * discount code, and it came out "Hoạt động" while the rest were suspended.
 */
describe('A locked partner creates nothing new (doitac-3010 #009)', () => {
  function service(status: PartnerStatusEnum) {
    const partner = { id: 5, partnerType: PartnerTypeEnum.KOL, status };
    const svc = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(svc, {
      partnerRepository: { findOne: jest.fn().mockResolvedValue(partner) },
      getPartnerOrThrowById: jest.fn().mockResolvedValue(partner),
    });
    return svc;
  }

  it.each([PartnerStatusEnum.HOLD, PartnerStatusEnum.DISABLED])(
    'should refuse a new link and a new code while %s',
    async (status) => {
      const svc = service(status);
      await expect(svc.createLink(5, {} as never)).rejects.toThrow(
        'đang bị tạm khoá nên không thể tạo thêm liên kết mới',
      );
      await expect(svc.createMyCoupon(5, {} as never)).rejects.toThrow(
        'đang bị tạm khoá nên không thể tạo thêm mã giảm giá mới',
      );
    },
  );
});
