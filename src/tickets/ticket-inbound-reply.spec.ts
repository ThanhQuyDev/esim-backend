import { TicketsService } from './tickets.service';
import { extractReplyText } from './email-reply-text';

/**
 * #059 — a customer's email reply is filed onto its ticket.
 *
 * Two things carry the risk. The quoted history has to be stripped, or a thread
 * is unreadable after two exchanges — but over-stripping would silently lose what
 * the customer wrote, so the extractor errs towards keeping too much. And the
 * sender has to be checked, or anyone who learns a ticket number can post into a
 * stranger's thread.
 */
describe('Inbound ticket replies (#059)', () => {
  describe('extracting the reply from a quoted email', () => {
    it('should cut the English quote header and everything under it', () => {
      const body = [
        'Vẫn chưa được ạ.',
        '',
        'On Mon, 1 Jan 2026 at 10:00, Support <hotro@esim.com.vn> wrote:',
        '> Bạn thử bật dữ liệu di động nhé.',
      ].join('\n');

      expect(extractReplyText(body)).toBe('Vẫn chưa được ạ.');
    });

    it('should cut the Vietnamese quote header', () => {
      const body = [
        'Tôi đã thử rồi.',
        '',
        'Vào Th 2, 1 thg 1, 2026 lúc 10:00 Support <hotro@esim.com.vn> đã viết:',
        '> Bạn thử bật dữ liệu di động nhé.',
      ].join('\n');

      expect(extractReplyText(body)).toBe('Tôi đã thử rồi.');
    });

    it('should cut an Outlook original-message block', () => {
      const body = [
        'Cảm ơn bạn.',
        '',
        '-----Original Message-----',
        'From: Support',
      ].join('\n');

      expect(extractReplyText(body)).toBe('Cảm ơn bạn.');
    });

    it('should cut at a signature separator', () => {
      const body = [
        'Đã xong, cảm ơn.',
        '-- ',
        'Nguyễn Văn A',
        '0900000000',
      ].join('\n');

      expect(extractReplyText(body)).toBe('Đã xong, cảm ơn.');
    });

    it("should cut at our own template's footer line", () => {
      const body = [
        'Vẫn lỗi ạ.',
        '',
        'Bạn có thể trả lời trực tiếp email này — phản hồi của bạn sẽ được ghi nhận vào phiếu HT-000123.',
      ].join('\n');

      expect(extractReplyText(body)).toBe('Vẫn lỗi ạ.');
    });

    it('should keep the whole body when nothing looks like a quote', () => {
      // The conservative case: a plain reply must survive untouched.
      const body =
        'Tôi vẫn chưa kích hoạt được eSIM.\nMáy báo lỗi "không có mạng".';

      expect(extractReplyText(body)).toBe(body);
    });

    it('should keep the original rather than storing nothing', () => {
      // A reply that is ONLY quoted text still tells support the customer wrote
      // back; an empty message would not.
      const body = '> Bạn thử bật dữ liệu di động nhé.';

      expect(extractReplyText(body)).toBe(body);
    });

    it('should handle empty input', () => {
      expect(extractReplyText('')).toBe('');
      expect(extractReplyText(null)).toBe('');
    });
  });

  describe('filing it onto the ticket', () => {
    function makeService(ticket: Record<string, unknown> | null) {
      const saved: Record<string, unknown>[] = [];

      const repository = {
        findByTicketNumber: jest.fn().mockResolvedValue(ticket),
        findById: jest.fn().mockResolvedValue(ticket),
        update: jest.fn().mockResolvedValue(ticket),
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
      id: 123,
      ticketNumber: 'HT-000123',
      customerEmail: 'khach@example.com',
      subject: 'Không kích hoạt được eSIM',
      status: 'open',
    };

    it('should file the reply as a customer message on the right ticket', async () => {
      const { service, saved } = makeService(TICKET);

      const filed = await service.ingestEmailReply({
        subject: 'Re: [HT-000123] Đã nhận yêu cầu hỗ trợ của bạn',
        fromEmail: 'khach@example.com',
        body: 'Vẫn chưa được ạ.',
      });

      expect(filed).toBe('HT-000123');
      expect(saved[0]).toMatchObject({
        ticketId: 123,
        authorRole: 'customer',
        body: 'Vẫn chưa được ạ.',
      });
    });

    it('should not email the customer their own reply back', async () => {
      const { service, mailService } = makeService(TICKET);

      await service.ingestEmailReply({
        subject: '[HT-000123] x',
        fromEmail: 'khach@example.com',
        body: 'Vẫn chưa được ạ.',
      });

      expect(mailService.sendTicketReply).not.toHaveBeenCalled();
    });

    it('should skip a mail whose subject names no ticket', async () => {
      const { service, repository, saved } = makeService(TICKET);

      const filed = await service.ingestEmailReply({
        subject: 'Xin chào, tôi cần hỗ trợ',
        fromEmail: 'khach@example.com',
        body: 'Giúp tôi với',
      });

      expect(filed).toBeNull();
      expect(repository.findByTicketNumber).not.toHaveBeenCalled();
      expect(saved).toEqual([]);
    });

    it('should skip a ticket number that does not exist', async () => {
      const { service, saved } = makeService(null);

      const filed = await service.ingestEmailReply({
        subject: '[HT-999999] x',
        fromEmail: 'khach@example.com',
        body: 'Giúp tôi với',
      });

      expect(filed).toBeNull();
      expect(saved).toEqual([]);
    });

    it("should refuse a reply from anyone but the ticket's own customer", async () => {
      // Otherwise knowing a ticket number is enough to post into someone's thread.
      const { service, saved } = makeService(TICKET);

      const filed = await service.ingestEmailReply({
        subject: '[HT-000123] x',
        fromEmail: 'nguoikhac@example.com',
        body: 'Cho tôi xem ICCID của đơn này',
      });

      expect(filed).toBeNull();
      expect(saved).toEqual([]);
    });

    it('should match the sender case-insensitively', async () => {
      const { service, saved } = makeService(TICKET);

      const filed = await service.ingestEmailReply({
        subject: '[HT-000123] x',
        fromEmail: 'KHACH@Example.COM',
        body: 'Vẫn chưa được ạ.',
      });

      expect(filed).toBe('HT-000123');
      expect(saved).toHaveLength(1);
    });

    it('should skip a mail with no sender at all', async () => {
      const { service, saved } = makeService(TICKET);

      const filed = await service.ingestEmailReply({
        subject: '[HT-000123] x',
        fromEmail: null,
        body: 'Vẫn chưa được ạ.',
      });

      expect(filed).toBeNull();
      expect(saved).toEqual([]);
    });
  });
});
