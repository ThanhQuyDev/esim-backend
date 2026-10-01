import { TicketsService } from './tickets.service';
import { parseTicketNumber, ticketNumberFor } from './ticket-number';

/**
 * #059 — a support request now gets a reference the customer can quote, an
 * automatic acknowledgement, and an emailed reply when an admin answers.
 *
 * The reference is the load-bearing part: it goes in every subject line, and it
 * is what a customer's reply will have to be matched back to.
 */
describe('Support ticket emails (#059)', () => {
  function makeService(
    ticket: Record<string, unknown> | null = null,
    opts: { mailFails?: boolean } = {},
  ) {
    const created: Record<string, unknown>[] = [];
    const updates: Record<string, unknown>[] = [];

    const repository = {
      create: jest.fn((data: Record<string, unknown>) => {
        created.push(data);
        return Promise.resolve({ id: 123, ...data });
      }),
      update: jest.fn((id: number, data: Record<string, unknown>) => {
        updates.push(data);
        // Faithful to the real repository, which merges into the existing row and
        // returns the whole thing — the service reads the customer's email back
        // off it to send the acknowledgement.
        return Promise.resolve({
          id,
          ...(ticket ?? created[created.length - 1] ?? {}),
          ...data,
        });
      }),
      findById: jest.fn().mockResolvedValue(ticket),
      countByEmailSince: jest.fn().mockResolvedValue(0),
      existsDuplicate: jest.fn().mockResolvedValue(false),
    };

    const messages = {
      find: jest.fn().mockResolvedValue([]),
      create: (row: unknown) => row,
      save: jest.fn((row: unknown) =>
        Promise.resolve({ id: 1, ...(row as object) }),
      ),
    };

    const fail = () => Promise.reject(new Error('SMTP down'));
    const mailService = {
      sendTicketAcknowledgement: jest.fn(
        opts.mailFails ? fail : () => Promise.resolve(undefined),
      ),
      sendTicketReply: jest.fn(
        opts.mailFails ? fail : () => Promise.resolve(undefined),
      ),
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

    return { service, repository, mailService, messages, created, updates };
  }

  const DTO = {
    customerEmail: 'khach@example.com',
    subject: 'Không kích hoạt được eSIM',
    description: 'Tôi đã quét QR nhưng máy báo lỗi.',
  };

  describe('the ticket number', () => {
    it('should be the id, zero-padded, with an HT- prefix', () => {
      expect(ticketNumberFor(123)).toBe('HT-000123');
      expect(ticketNumberFor(1)).toBe('HT-000001');
    });

    it('should be assigned on create, once the row has an id', async () => {
      const { service, updates } = makeService();

      await service.create(DTO as never);

      expect(updates[0]).toEqual({ ticketNumber: 'HT-000123' });
    });

    it('should be read back out of a subject line whatever the client did to it', () => {
      // A reply's subject is rarely the one that was sent.
      expect(parseTicketNumber('[HT-000123] Đã nhận yêu cầu')).toBe(
        'HT-000123',
      );
      expect(parseTicketNumber('Re: [HT-000123] Đã nhận yêu cầu')).toBe(
        'HT-000123',
      );
      expect(parseTicketNumber('RE: Fwd:  [ht-000123]  abc')).toBe('HT-000123');
    });

    it('should need at least four digits, so stray text cannot look like a ticket', () => {
      // This decides which ticket an inbound reply joins, so a false positive
      // would attach a stranger's email to somebody's thread. A miss is safer.
      expect(parseTicketNumber('HT-123')).toBeNull();
      expect(parseTicketNumber('Mã HT-1 của bạn')).toBeNull();
      expect(parseTicketNumber('[HT-0123]')).toBe('HT-000123');
    });

    it('should be null when a subject mentions no ticket', () => {
      expect(parseTicketNumber('Xin chào')).toBeNull();
      expect(parseTicketNumber('')).toBeNull();
      expect(parseTicketNumber(null)).toBeNull();
    });
  });

  describe('the acknowledgement', () => {
    it('should go out with the number, subject and what the customer wrote', async () => {
      const { service, mailService } = makeService();

      await service.create(DTO as never);

      expect(mailService.sendTicketAcknowledgement).toHaveBeenCalledWith({
        to: 'khach@example.com',
        ticketNumber: 'HT-000123',
        ticketSubject: DTO.subject,
        ticketDescription: DTO.description,
      });
    });

    it('should also be posted into the thread, for the portal to show (#060)', async () => {
      // A partner raises support from the portal and watches the thread there, so
      // an email-only acknowledgement leaves the portal looking inert.
      const { service, messages } = makeService();

      await service.create(DTO as never);

      expect(messages.save).toHaveBeenCalledTimes(1);
      const saved = messages.save.mock.calls[0][0] as Record<string, unknown>;
      expect(saved).toMatchObject({ ticketId: 123, authorRole: 'admin' });
      expect(String(saved.body)).toContain('HT-000123');
      expect(String(saved.body)).toContain('Cảm ơn bạn đã liên hệ');
    });

    it('should not email the acknowledgement twice (#060)', async () => {
      // The thread message is written straight to the repository; routing it
      // through `addMessage` would send a second, admin-authored email.
      const { service, mailService } = makeService();

      await service.create(DTO as never);

      expect(mailService.sendTicketAcknowledgement).toHaveBeenCalledTimes(1);
      expect(mailService.sendTicketReply).not.toHaveBeenCalled();
    });

    it('should still return the ticket when the email fails', async () => {
      // The ticket IS the record of the request; a mail outage must not lose it.
      const { service } = makeService(null, { mailFails: true });

      const ticket = await service.create(DTO as never);

      expect(ticket.ticketNumber).toBe('HT-000123');
    });
  });

  describe('an admin reply', () => {
    const OPEN = {
      id: 123,
      ticketNumber: 'HT-000123',
      customerEmail: 'khach@example.com',
      subject: 'Không kích hoạt được eSIM',
      status: 'open',
    };

    it('should be emailed to the customer', async () => {
      const { service, mailService } = makeService(OPEN);

      await service.addMessage(
        123,
        { isAdmin: true, name: 'CSKH' },
        { body: 'Bạn thử bật dữ liệu di động nhé.' },
      );

      expect(mailService.sendTicketReply).toHaveBeenCalledWith({
        to: 'khach@example.com',
        ticketNumber: 'HT-000123',
        ticketSubject: OPEN.subject,
        replyBody: 'Bạn thử bật dữ liệu di động nhé.',
      });
    });

    it("should not be emailed when it is the customer's own reply", async () => {
      // Otherwise the customer receives their own message back.
      const { service, mailService } = makeService(OPEN);

      await service.addMessage(
        123,
        { isAdmin: false, email: 'khach@example.com', name: 'Khách' },
        { body: 'Vẫn chưa được ạ.' },
      );

      expect(mailService.sendTicketReply).not.toHaveBeenCalled();
    });

    it('should fall back to a derived number for a ticket that predates the column', async () => {
      const { service, mailService } = makeService({
        ...OPEN,
        ticketNumber: null,
      });

      await service.addMessage(123, { isAdmin: true }, { body: 'Xin chào' });

      expect(mailService.sendTicketReply).toHaveBeenCalledWith(
        expect.objectContaining({ ticketNumber: 'HT-000123' }),
      );
    });

    it('should still save the message when the email fails', async () => {
      // The reply is already visible in the CMS; losing the email must not lose it.
      const { service, messages } = makeService(OPEN, { mailFails: true });

      const message = await service.addMessage(
        123,
        { isAdmin: true },
        { body: 'Xin chào' },
      );

      expect(messages.save).toHaveBeenCalled();
      expect(message).toBeDefined();
    });
  });
});
