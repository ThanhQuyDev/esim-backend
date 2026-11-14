import { TicketsService } from './tickets.service';

/**
 * vande-1411 #032 — a customer's or a partner's reply by email goes onto the
 * ticket's conversation, with the files it carried; a "Đã giải quyết" ticket
 * goes back to "Đang xử lý", a "Đã đóng" one stays closed.
 */
describe('Trả lời qua email vào hội thoại ticket (vande-1411 #032)', () => {
  function makeService(ticket: Record<string, unknown>) {
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
      sendTicketClosedReply: jest.fn().mockResolvedValue(undefined),
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

  const ticket = (status: string, extra: Record<string, unknown> = {}) => ({
    id: 7,
    ticketNumber: 'HT-000007',
    customerEmail: 'khach@example.com',
    subject: 'eSIM',
    status,
    ...extra,
  });

  it('should reopen a resolved ticket as "đang xử lý" when the customer answers by email', async () => {
    const { service, repository } = makeService(ticket('resolved'));
    await service.ingestEmailReply({
      subject: 'Re: [HT-000007] Phản hồi',
      fromEmail: 'khach@example.com',
      body: 'Vẫn chưa được ạ.',
    });
    expect(repository.update).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ status: 'in_progress' }),
    );
  });

  it('should keep a closed ticket closed, and say so by email', async () => {
    const { service, repository, mailService } = makeService(ticket('closed'));
    await service.ingestEmailReply({
      subject: 'Re: [HT-000007] Phản hồi',
      fromEmail: 'khach@example.com',
      body: 'Còn một câu hỏi.',
    });
    const statuses = repository.update.mock.calls
      .map((c) => (c[1] as { status?: string }).status)
      .filter(Boolean);
    expect(statuses).not.toContain('in_progress');
    expect(mailService.sendTicketClosedReply).toHaveBeenCalled();
  });

  it("should file a partner's reply, with its attachment", async () => {
    const { service, saved } = makeService(
      ticket('in_progress', {
        customerEmail: 'doitac@congty.vn',
        fromPartner: true,
      }),
    );
    const filed = await service.ingestEmailReply({
      subject: 'Re: [HT-000007] Phản hồi',
      fromEmail: 'DoiTac@CongTy.vn',
      body: 'Gửi anh ảnh lỗi.',
      attachments: ['https://res.cloudinary.com/x/image/upload/loi.png'],
    });
    expect(filed).toBe('HT-000007');
    expect(saved[0]).toMatchObject({
      authorRole: 'customer',
      body: 'Gửi anh ảnh lỗi.',
      attachments: ['https://res.cloudinary.com/x/image/upload/loi.png'],
    });
  });
});
