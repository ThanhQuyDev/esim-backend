import {
  INBOX_POLL_DEADLINE_MS,
  TicketInboundMailService,
} from './ticket-inbound-mail.service';

/** Each test decides how the mail server behaves. */
const imap = {
  connect: jest.fn(),
  close: jest.fn(),
  logout: jest.fn(),
  getMailboxLock: jest.fn(),
  search: jest.fn(),
};

jest.mock('imapflow', () => ({
  ImapFlow: jest.fn().mockImplementation(() => imap),
}));

/**
 * vande #048 — a stalled mailbox connection used to hold the poll open for
 * good: every later tick logged "previous inbox poll still running" and no
 * email reply was filed again until the API restarted.
 */
describe('TicketInboundMailService poll deadline (vande #048)', () => {
  const config = {
    get: () => ({
      host: 'mail.test',
      port: 993,
      secure: true,
      user: 'support@test',
      password: 'x',
      mailbox: 'INBOX',
    }),
  };
  const service = () =>
    new TicketInboundMailService(config as never, {} as never);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  it('should drop a stalled connection after the deadline and poll again next tick', async () => {
    let fail: (e: Error) => void = () => undefined;
    // connect() never answers until the socket is closed.
    imap.connect.mockImplementation(
      () => new Promise((_, reject) => (fail = reject)),
    );
    imap.close.mockImplementation(() => fail(new Error('Connection closed')));
    const s = service();

    const first = s.pollInbox();
    await jest.advanceTimersByTimeAsync(INBOX_POLL_DEADLINE_MS + 1);
    await expect(first).resolves.toEqual({ processed: 0, skipped: 0 });
    expect(imap.close).toHaveBeenCalled();

    // The next tick really polls instead of skipping.
    imap.connect.mockResolvedValue(undefined);
    imap.getMailboxLock.mockResolvedValue({ release: jest.fn() });
    imap.search.mockResolvedValue([]);
    imap.logout.mockResolvedValue(undefined);
    await s.pollInbox();
    expect(imap.connect).toHaveBeenCalledTimes(2);
    expect(imap.search).toHaveBeenCalled();
  });

  it('should not wait forever on a logout that never answers', async () => {
    imap.connect.mockResolvedValue(undefined);
    imap.getMailboxLock.mockResolvedValue({ release: jest.fn() });
    imap.search.mockResolvedValue([]);
    imap.logout.mockImplementation(() => new Promise(() => undefined));
    const s = service();

    const poll = s.pollInbox();
    await jest.advanceTimersByTimeAsync(6_000);
    await expect(poll).resolves.toEqual({ processed: 0, skipped: 0 });
    expect(imap.close).toHaveBeenCalled();
  });
});
