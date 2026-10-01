import { TicketsService } from './tickets.service';
import { TicketStatus, TICKET_AUTO_CLOSE_HOURS } from './ticket-status';

/**
 * #061 — the ticket status lifecycle.
 *
 *   Mới ──(admin opens it)──▶ Đang xử lý ──(admin marks it)──▶ Đã giải quyết
 *                                                                   │ 48h
 *                                                                   ▼
 *                                                              Đã đóng
 *
 * The risks are all about moving a ticket somebody else moved on purpose: merely
 * re-reading a resolved ticket must not drag it back into the queue, a reopened
 * ticket must not be closed against its first resolution, and a close that failed
 * must not tell the customer it succeeded.
 */
describe('Ticket lifecycle (#061)', () => {
  function makeService(
    ticket: Record<string, unknown> | null,
    opts: { due?: Record<string, unknown>[]; updateFails?: boolean } = {},
  ) {
    const updates: { id: unknown; data: Record<string, unknown> }[] = [];
    const saved: Record<string, unknown>[] = [];

    const repository = {
      findById: jest.fn().mockResolvedValue(ticket),
      findResolvedBefore: jest.fn().mockResolvedValue(opts.due ?? []),
      update: jest.fn((id: unknown, data: Record<string, unknown>) => {
        if (opts.updateFails) return Promise.reject(new Error('db down'));
        updates.push({ id, data });
        return Promise.resolve({ ...(ticket ?? {}), id, ...data });
      }),
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
      sendTicketAcknowledgement: jest.fn().mockResolvedValue(undefined),
      sendTicketReply: jest.fn().mockResolvedValue(undefined),
      sendTicketResolved: jest.fn().mockResolvedValue(undefined),
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

    return { service, repository, messages, mailService, updates, saved };
  }

  describe('opening the detail', () => {
    it('should move a new ticket to in progress', async () => {
      const { service, updates } = makeService({
        id: 1,
        status: TicketStatus.NEW,
      });

      const ticket = await service.findByIdForAdmin(1);

      expect(updates[0].data).toEqual({ status: TicketStatus.IN_PROGRESS });
      expect(ticket?.status).toBe(TicketStatus.IN_PROGRESS);
    });

    it('should leave a ticket already in progress alone', async () => {
      const { service, repository } = makeService({
        id: 1,
        status: TicketStatus.IN_PROGRESS,
      });

      await service.findByIdForAdmin(1);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should not drag a resolved ticket back into the queue', async () => {
      // Re-reading a resolved ticket is not picking it up again, and it would
      // restart the 48-hour clock.
      const { service, repository } = makeService({
        id: 1,
        status: TicketStatus.RESOLVED,
      });

      await service.findByIdForAdmin(1);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should not reopen a closed ticket', async () => {
      const { service, repository } = makeService({
        id: 1,
        status: TicketStatus.CLOSED,
      });

      await service.findByIdForAdmin(1);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should return null for a ticket that does not exist', async () => {
      const { service } = makeService(null);

      expect(await service.findByIdForAdmin(99)).toBeNull();
    });
  });

  describe('marking it resolved', () => {
    it('should stamp the moment the clock starts from', async () => {
      const { service, updates } = makeService({ id: 1 });

      await service.updateStatus(1, TicketStatus.RESOLVED);

      expect(updates[0].data.status).toBe(TicketStatus.RESOLVED);
      expect(updates[0].data.resolvedAt).toBeInstanceOf(Date);
    });

    it('should clear the clock when the ticket leaves resolved', async () => {
      // A ticket reopened and resolved again must be measured from the SECOND
      // resolution, not the first.
      const { service, updates } = makeService({ id: 1 });

      await service.updateStatus(1, TicketStatus.IN_PROGRESS);

      expect(updates[0].data.resolvedAt).toBeNull();
    });
  });

  describe('the 48-hour auto-close', () => {
    const DUE = {
      id: 7,
      ticketNumber: 'HT-000007',
      customerEmail: 'khach@example.com',
      subject: 'Không kích hoạt được eSIM',
      status: TicketStatus.RESOLVED,
    };

    it('should wait 48 hours', () => {
      expect(TICKET_AUTO_CLOSE_HOURS).toBe(48);
    });

    it('should ask for tickets resolved before the cutoff', async () => {
      const { service, repository } = makeService(null, { due: [] });
      const before = Date.now();

      await service.closeResolvedTickets();

      const cutoff = repository.findResolvedBefore.mock.calls[0][0] as Date;
      const expected = before - TICKET_AUTO_CLOSE_HOURS * 60 * 60 * 1000;
      expect(Math.abs(cutoff.getTime() - expected)).toBeLessThan(1000);
    });

    it('should close them and tell the customer, by email and in the thread', async () => {
      const { service, updates, saved, mailService } = makeService(DUE, {
        due: [DUE],
      });

      const closed = await service.closeResolvedTickets();

      expect(closed).toBe(1);
      expect(updates[0].data).toEqual({ status: TicketStatus.CLOSED });
      // In the thread too, because a partner follows their ticket in the portal.
      expect(String(saved[0].body)).toContain('Đã giải quyết');
      expect(mailService.sendTicketResolved).toHaveBeenCalledWith({
        to: 'khach@example.com',
        ticketNumber: 'HT-000007',
        ticketSubject: DUE.subject,
      });
    });

    it('should do nothing when nothing is due', async () => {
      const { service, repository, mailService } = makeService(null, {
        due: [],
      });

      expect(await service.closeResolvedTickets()).toBe(0);
      expect(repository.update).not.toHaveBeenCalled();
      expect(mailService.sendTicketResolved).not.toHaveBeenCalled();
    });

    it('should not claim a close that failed', async () => {
      // The status never changed, so telling the customer it did would be a lie.
      const { service, mailService, saved } = makeService(DUE, {
        due: [DUE],
        updateFails: true,
      });

      const closed = await service.closeResolvedTickets();

      expect(closed).toBe(0);
      expect(mailService.sendTicketResolved).not.toHaveBeenCalled();
      expect(saved).toEqual([]);
    });

    it('should still close the ticket when the notice email fails', async () => {
      // The close already happened; a mail outage must not undo it.
      const { service, updates, mailService } = makeService(DUE, {
        due: [DUE],
      });
      mailService.sendTicketResolved.mockRejectedValueOnce(
        new Error('SMTP down'),
      );

      const closed = await service.closeResolvedTickets();

      expect(closed).toBe(1);
      expect(updates[0].data).toEqual({ status: TicketStatus.CLOSED });
    });

    it('should keep going after one ticket fails', async () => {
      const second = { ...DUE, id: 8, ticketNumber: 'HT-000008' };
      const { service, mailService } = makeService(DUE, { due: [DUE, second] });
      mailService.sendTicketResolved.mockRejectedValueOnce(
        new Error('SMTP down'),
      );

      const closed = await service.closeResolvedTickets();

      expect(closed).toBe(2);
      expect(mailService.sendTicketResolved).toHaveBeenCalledTimes(2);
    });
  });
});
