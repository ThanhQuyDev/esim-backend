import { TicketsService } from './tickets.service';
import { nextStatusAfterReply, TicketStatus } from './ticket-status';
import { ticketThreadId, ticketThreadSubject } from '../mail/mail.service';
import {
  MAX_EMAIL_ATTACHMENTS,
  pickEmailAttachments,
} from './ticket-email-attachments';

/**
 * #041 (test round 4) — a ticket behaves as one conversation, by email too.
 *
 * What the tester found: every admin reply arrived as a new email thread, a
 * customer writing into a closed ticket got no answer, closing by hand sent
 * nothing, and emailed photos were dropped.
 */

function makeService(ticket: Record<string, unknown> | null) {
  const saved: Record<string, unknown>[] = [];
  const repository = {
    findByTicketNumber: jest.fn().mockResolvedValue(ticket),
    findById: jest.fn().mockResolvedValue(ticket),
    update: jest
      .fn()
      .mockImplementation((_id, patch) =>
        Promise.resolve(ticket ? { ...ticket, ...patch } : null),
      ),
  };
  const messages = {
    find: jest.fn().mockResolvedValue([]),
    create: (row: unknown) => row,
    save: jest.fn((row: Record<string, unknown>) => {
      saved.push(row);
      return Promise.resolve({ id: 1, ...row });
    }),
  };
  const mailService = {
    sendTicketAcknowledgement: jest.fn(),
    sendTicketReply: jest.fn(),
    sendTicketResolved: jest.fn(),
    sendTicketClosedReply: jest.fn(),
  };
  const service = new TicketsService(
    repository as never,
    messages as never,
    mailService as never,
  );
  (service as unknown as Record<string, unknown>).logger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  return { service, repository, saved, mailService };
}

const TICKET = {
  id: 5,
  ticketNumber: 'HT-000005',
  customerEmail: 'khach@example.com',
  subject: 'Không kích hoạt được eSIM',
  status: 'in_progress',
};

describe('Ticket conversation (#041, test round 4)', () => {
  describe('status after a reply', () => {
    it.each([
      ['resolved', 'customer', 'in_progress'],
      ['need_info', 'customer', 'in_progress'],
      ['open', 'customer', 'open'],
      ['in_progress', 'customer', 'in_progress'],
      ['closed', 'customer', 'closed'],
      ['closed', 'admin', 'in_progress'],
      ['resolved', 'admin', 'resolved'],
    ])('should take %s after a %s reply to %s', (from, author, to) => {
      expect(nextStatusAfterReply(from, author as 'customer' | 'admin')).toBe(
        to,
      );
    });
  });

  describe('closing by hand', () => {
    it('should email the customer when an admin closes the ticket', async () => {
      const { service, mailService } = makeService(TICKET);

      await service.updateStatus(5, TicketStatus.CLOSED);

      expect(mailService.sendTicketResolved).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'khach@example.com',
          ticketNumber: 'HT-000005',
        }),
      );
    });

    it('should not email again for a ticket that was already closed', async () => {
      const { service, mailService } = makeService({
        ...TICKET,
        status: 'closed',
      });

      await service.updateStatus(5, TicketStatus.CLOSED);

      expect(mailService.sendTicketResolved).not.toHaveBeenCalled();
    });

    it('should accept the new "cần bổ sung thông tin" status', async () => {
      const { service, repository } = makeService(TICKET);

      await service.updateStatus(5, TicketStatus.NEED_INFO);

      expect(repository.update).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ status: 'need_info' }),
      );
    });

    it('should reject a status that does not exist', async () => {
      const { service } = makeService(TICKET);

      await expect(service.updateStatus(5, 'done')).rejects.toThrow(
        'Trạng thái không hợp lệ',
      );
    });
  });

  describe('replies by email', () => {
    it('should file an attachment-only reply with its uploaded files', async () => {
      const { service, saved } = makeService(TICKET);

      const filed = await service.ingestEmailReply({
        subject: 'Re: [HT-000005] Đã nhận yêu cầu hỗ trợ của bạn',
        fromEmail: 'khach@example.com',
        body: '',
        attachments: ['https://res.cloudinary.com/x/image/upload/a.jpg'],
      });

      expect(filed).toBe('HT-000005');
      expect(saved[0]).toMatchObject({
        authorRole: 'customer',
        attachments: ['https://res.cloudinary.com/x/image/upload/a.jpg'],
      });
    });

    it('should name an attachment that could not be uploaded', async () => {
      const { service, saved } = makeService(TICKET);

      await service.ingestEmailReply({
        subject: '[HT-000005] Re: ảnh lỗi',
        fromEmail: 'khach@example.com',
        body: 'Ảnh đây ạ',
        unsavedAttachmentNames: ['loi.png'],
      });

      expect(String(saved[0].body)).toContain('Ảnh đây ạ');
      expect(String(saved[0].body)).toContain('loi.png');
    });

    it('should answer a reply to a closed ticket with the "đã đóng" email', async () => {
      const { service, mailService } = makeService({
        ...TICKET,
        status: 'closed',
      });

      await service.ingestEmailReply({
        subject: 'Re: [HT-000005] Đã nhận yêu cầu hỗ trợ của bạn',
        fromEmail: 'khach@example.com',
        body: 'Còn lỗi ạ',
      });

      expect(mailService.sendTicketClosedReply).toHaveBeenCalledTimes(1);
    });
  });

  describe('one email thread per ticket', () => {
    it('should give every email of a ticket the same thread id', () => {
      expect(ticketThreadId('HT-000005')).toBe(
        '<ticket-ht-000005@esim.com.vn>',
      );
    });

    it('should reuse the first email subject behind a single "Re:"', () => {
      expect(
        ticketThreadSubject('[HT-000005] Đã nhận yêu cầu hỗ trợ của bạn'),
      ).toBe('Re: [HT-000005] Đã nhận yêu cầu hỗ trợ của bạn');
      expect(ticketThreadSubject('Re: RE: [HT-000005] abc')).toBe(
        'Re: [HT-000005] abc',
      );
    });
  });

  describe('which email attachments are kept', () => {
    const file = (over: Record<string, unknown>) => ({
      filename: 'a.jpg',
      contentType: 'image/jpeg',
      size: 1000,
      content: Buffer.from('x'),
      ...over,
    });

    it('should keep photos and PDFs, drop signature logos and other types', () => {
      const kept = pickEmailAttachments([
        file({}),
        file({ filename: 'b.pdf', contentType: 'application/pdf' }),
        file({ filename: 'logo.png', contentType: 'image/png', related: true }),
        file({ filename: 'x.exe', contentType: 'application/x-msdownload' }),
        file({ filename: 'big.jpg', size: 50 * 1024 * 1024 }),
      ]);

      expect(kept.map((f) => f.filename)).toEqual(['a.jpg', 'b.pdf']);
    });

    it('should keep at most the allowed number of files', () => {
      const many = Array.from({ length: 9 }, (_, i) =>
        file({ filename: `${i}.jpg` }),
      );
      expect(pickEmailAttachments(many)).toHaveLength(MAX_EMAIL_ATTACHMENTS);
    });
  });
});
