import { NotFoundException } from '@nestjs/common';
import { PartnersService } from './partners.service';
import {
  isHtmlBody,
  notificationBodyHtml,
  notificationBodyText,
  sanitizeNotificationHtml,
} from './notification-html';

/**
 * Announcements, test round of 14/10 (doitac-1410 #062): a rich-text body,
 * a priority and "nổi bật" for the banner, and "Sửa" / "Xóa" on the sent list.
 */

describe('notification HTML (doitac-1410 #062)', () => {
  it('should keep formatting and drop what could run', () => {
    const html = sanitizeNotificationHtml(
      '<p onclick="steal()">Xin <strong>chào</strong></p><script>alert(1)</script>' +
        '<a href="javascript:alert(1)">x</a><iframe src="https://evil"></iframe>' +
        '<img src="https://cdn.esim.vn/a.png" onerror="x()">',
    );

    expect(html).toContain('<strong>chào</strong>');
    expect(html).toContain('<img src="https://cdn.esim.vn/a.png">');
    expect(html).not.toMatch(/script|onclick|onerror|javascript:|iframe/i);
  });

  it('should keep the line breaks of an old plain-text body in the email', () => {
    expect(isHtmlBody('Dòng 1\nDòng 2')).toBe(false);
    expect(notificationBodyHtml('A < B\nDòng 2')).toBe('A &lt; B<br>Dòng 2');
  });

  it('should give the email a readable text part', () => {
    expect(
      notificationBodyText(
        '<p>Bảo trì <b>01:00</b></p><p>Xin lỗi &amp; cảm ơn</p>',
      ),
    ).toBe('Bảo trì 01:00\nXin lỗi & cảm ơn');
  });
});

describe('Sửa / Xóa a sent announcement (doitac-1410 #062)', () => {
  function buildService(found: Record<string, unknown> | null) {
    const notificationRepository = {
      findOne: jest.fn().mockResolvedValue(found),
      save: jest.fn().mockImplementation((n) => Promise.resolve(n)),
      softDelete: jest.fn().mockResolvedValue({}),
    };
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, { notificationRepository });
    return { service, notificationRepository };
  }

  it('should save the new text, priority and featured flag', async () => {
    const { service } = buildService({ id: 3, partnerId: null, title: 'Cũ' });

    const saved = await service.adminUpdateNotification(3, {
      title: ' Mới ',
      body: '<p>Nội dung</p><script>x</script>',
      priority: 'urgent',
      isFeatured: true,
    });

    expect(saved).toMatchObject({
      title: 'Mới',
      body: '<p>Nội dung</p>',
      priority: 'urgent',
      isFeatured: true,
    });
    expect(saved.updatedAt).toBeInstanceOf(Date);
  });

  it('should not touch a notice sent to one partner', async () => {
    const { service } = buildService({ id: 3, partnerId: 9 });

    await expect(
      service.adminUpdateNotification(3, { title: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should delete softly, so read records stay', async () => {
    const { service, notificationRepository } = buildService({
      id: 3,
      partnerId: null,
    });

    await service.adminDeleteNotification(3);

    expect(notificationRepository.softDelete).toHaveBeenCalledWith(3);
  });
});

describe('PartnersService.getMyNotifications (doitac-1410 #062)', () => {
  it('should hand back the featured ones apart, read or not, and skip deleted', async () => {
    const row = {
      id: '5',
      title: 'Khẩn',
      body: '<p>x</p>',
      createdAt: new Date(),
      priority: 'urgent',
      isFeatured: true,
      isRead: true,
    };
    const query = jest
      .fn()
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([row]);
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      dataSource: { query },
      getPartnerOrThrowById: jest
        .fn()
        .mockResolvedValue({ id: 9, partnerType: 'kol' }),
    });

    const result = await service.getMyNotifications(9);

    expect(result.featured).toEqual([
      expect.objectContaining({ id: 5, priority: 'urgent', isRead: true }),
    ]);
    const [featuredSql] = query.mock.calls[1] as [string];
    expect(featuredSql).toContain('n."isFeatured"');
    expect(featuredSql).toContain('n."deletedAt" IS NULL');
  });
});
