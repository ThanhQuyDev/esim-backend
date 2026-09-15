import { HttpStatus } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import {
  clientIp,
  SlidingWindowLimiter,
  TICKET_EMAIL_LIMIT,
  TICKET_IP_LIMIT,
} from './ticket-spam-guard';
import type { CreateTicketDto } from './dto/create-ticket.dto';

/**
 * Server-side spam guard on `POST /api/v1/tickets` (#033).
 *
 * The browser's own checks are skipped by anything that posts to the API
 * directly, so the server now refuses: a filled honeypot, too many tickets from
 * one IP, too many from one email, and an identical request sent again.
 */

const REQUEST: CreateTicketDto = {
  customerEmail: 'khach@example.com',
  subject: 'eSIM không kích hoạt được',
  description: 'Máy báo không kích hoạt được, mong được hỗ trợ.',
};

function makeService(opts: { sentByEmail?: number; duplicate?: boolean } = {}) {
  const repository = {
    create: jest.fn((data: object) => Promise.resolve({ id: 1, ...data })),
    countByEmailSince: jest.fn().mockResolvedValue(opts.sentByEmail ?? 0),
    existsDuplicate: jest.fn().mockResolvedValue(opts.duplicate ?? false),
  };
  const service = new TicketsService(repository as never);
  return { service, repository };
}

async function statusOf(promise: Promise<unknown>): Promise<number | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    return (error as { getStatus: () => number }).getStatus();
  }
}

describe('Ticket spam guard', () => {
  it('should accept an ordinary request', async () => {
    const { service, repository } = makeService();

    await expect(service.create(REQUEST, '203.0.113.5')).resolves.toMatchObject(
      {
        id: 1,
      },
    );
    expect(repository.create).toHaveBeenCalled();
  });

  it('should refuse a request that filled the hidden honeypot field', async () => {
    const { service, repository } = makeService();

    await expect(
      statusOf(
        service.create(
          { ...REQUEST, website: 'http://spam.example' },
          '203.0.113.5',
        ),
      ),
    ).resolves.toBe(HttpStatus.BAD_REQUEST);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('should refuse the ticket after the per-IP limit, but not other visitors', async () => {
    const { service } = makeService();

    for (let i = 0; i < TICKET_IP_LIMIT; i += 1) {
      await service.create(
        { ...REQUEST, customerEmail: `k${i}@example.com` },
        '203.0.113.9',
      );
    }

    await expect(
      statusOf(service.create(REQUEST, '203.0.113.9')),
    ).resolves.toBe(HttpStatus.TOO_MANY_REQUESTS);
    await expect(
      statusOf(service.create(REQUEST, '198.51.100.1')),
    ).resolves.toBeNull();
  });

  it('should refuse an email that already opened too many tickets this hour', async () => {
    const { service, repository } = makeService({
      sentByEmail: TICKET_EMAIL_LIMIT,
    });

    await expect(
      statusOf(service.create(REQUEST, '203.0.113.5')),
    ).resolves.toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('should refuse the exact same request sent again', async () => {
    const { service, repository } = makeService({ duplicate: true });

    await expect(
      statusOf(service.create(REQUEST, '203.0.113.5')),
    ).resolves.toBe(HttpStatus.CONFLICT);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('should tell the client how long to wait when rate limited', async () => {
    const { service } = makeService({ sentByEmail: TICKET_EMAIL_LIMIT });

    try {
      await service.create(REQUEST, '203.0.113.5');
      fail('expected a rate limit');
    } catch (error) {
      const body = (error as { getResponse: () => object }).getResponse();
      expect(body).toMatchObject({
        errors: { ticket: 'tooManyTickets' },
        retryAfterSeconds: expect.any(Number),
      });
    }
  });
});

describe('SlidingWindowLimiter', () => {
  it('should free a slot once the oldest attempt ages out', () => {
    const limiter = new SlidingWindowLimiter(2, 1000);

    expect(limiter.hit('ip', 0).ok).toBe(true);
    expect(limiter.hit('ip', 100).ok).toBe(true);
    expect(limiter.hit('ip', 200)).toEqual({ ok: false, retryAfterMs: 800 });
    expect(limiter.hit('ip', 1000).ok).toBe(true);
  });
});

describe('clientIp', () => {
  it('should read the address nginx puts in X-Real-IP', () => {
    expect(
      clientIp({ headers: { 'x-real-ip': '203.0.113.7' }, ip: '127.0.0.1' }),
    ).toBe('203.0.113.7');
  });

  it('should fall back to the socket address without a proxy', () => {
    expect(clientIp({ headers: {}, ip: '198.51.100.2' })).toBe('198.51.100.2');
  });
});
