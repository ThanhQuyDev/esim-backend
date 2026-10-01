import { TicketsService } from './tickets.service';

/**
 * Replying inside a support ticket (#032).
 *
 * A ticket used to be a one-way form — the partner described a problem and had
 * nowhere to answer the question that came back. Both sides now write in the
 * same thread, which also means the thread has to be protected: it carries
 * order numbers, ICCIDs and whatever the customer pasted in.
 */

function buildService(ticket: Record<string, unknown> | null) {
  const update = jest.fn();
  const save = jest
    .fn()
    .mockImplementation((row) => Promise.resolve({ id: 9, ...row }));

  const repository = {
    findById: jest.fn().mockResolvedValue(ticket),
    update,
  };
  const messages = {
    find: jest.fn().mockResolvedValue([]),
    create: (row: unknown) => row,
    save,
  };

  // An admin's reply is emailed to the customer (#059); these tests are about the
  // stored thread, so the mail side is stubbed and asserted separately.
  const mailService = {
    sendTicketAcknowledgement: jest.fn().mockResolvedValue(undefined),
    sendTicketReply: jest.fn().mockResolvedValue(undefined),
  };

  const service = new TicketsService(
    repository as never,
    messages as never,
    mailService as never,
  );
  return { service, save, update, messages, mailService };
}

const OWNER = { email: 'kol@esim.vn', isAdmin: false, name: 'Nguyễn Văn A' };

describe('TicketsService — the conversation on a ticket (#032)', () => {
  it('should let the partner who opened it reply', async () => {
    const { service, save } = buildService({
      id: 3,
      customerEmail: 'KOL@esim.vn',
      status: 'open',
    });

    await service.addMessage(3, OWNER, {
      body: '  Đã gửi ảnh chụp màn hình  ',
    });

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 3,
        authorRole: 'customer',
        body: 'Đã gửi ảnh chụp màn hình',
      }),
    );
  });

  it('should refuse somebody else’s ticket', async () => {
    const { service, save } = buildService({
      id: 3,
      customerEmail: 'someone.else@esim.vn',
      status: 'open',
    });

    await expect(
      service.addMessage(3, OWNER, { body: 'Cho tôi xem với' }),
    ).rejects.toThrow('không thuộc về bạn');
    await expect(service.listMessages(3, OWNER)).rejects.toThrow(
      'không thuộc về bạn',
    );

    expect(save).not.toHaveBeenCalled();
  });

  it('should let staff into any ticket, as the admin side of the thread', async () => {
    const { service, save } = buildService({
      id: 3,
      customerEmail: 'kol@esim.vn',
      status: 'open',
    });

    await service.addMessage(
      3,
      { email: 'admin@esim.vn', isAdmin: true, name: 'Hỗ trợ' },
      { body: 'Đã kiểm tra, mã eSIM của bạn vẫn hoạt động.' },
    );

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ authorRole: 'admin' }),
    );
  });

  it('should reopen a closed ticket when somebody writes again', async () => {
    const { service, update } = buildService({
      id: 3,
      customerEmail: 'kol@esim.vn',
      status: 'closed',
    });

    await service.addMessage(3, OWNER, { body: 'Vẫn chưa được ạ' });

    expect(update).toHaveBeenCalledWith(3, { status: 'open' });
  });

  it('should refuse an empty reply', async () => {
    const { service, save } = buildService({
      id: 3,
      customerEmail: 'kol@esim.vn',
      status: 'open',
    });

    await expect(service.addMessage(3, OWNER, { body: '   ' })).rejects.toThrow(
      'không được để trống',
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('should say when the ticket does not exist at all', async () => {
    const { service } = buildService(null);

    await expect(service.listMessages(404, OWNER)).rejects.toThrow(
      'Không tìm thấy yêu cầu hỗ trợ',
    );
  });
});
