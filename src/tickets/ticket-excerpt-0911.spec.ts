import { ticketExcerpt } from './tickets.service';

/** doitac-0911 #022 — "Lịch sử ticket" shows what the partner wrote. */
describe('ticketExcerpt (doitac-0911 #022)', () => {
  it('should drop the request kind, order and ICCID lines', () => {
    expect(
      ticketExcerpt(
        'Hoàn tiền đơn hàng / eSIM lỗi\nĐơn hàng: PTN-261104004736115-O6YPBE\nICCID: 8900000673921306931\n\nyêu cầu hoàn tiền cho đại lý',
      ),
    ).toBe('yêu cầu hoàn tiền cho đại lý');
  });

  it('should keep a plain message as it is, on one line', () => {
    expect(ticketExcerpt('Khách báo không vào mạng\nđược ở sân bay')).toBe(
      'Khách báo không vào mạng được ở sân bay',
    );
  });

  it('should cut a long message', () => {
    const text = ticketExcerpt('a'.repeat(400));
    expect(text).toHaveLength(200);
    expect(text.endsWith('...')).toBe(true);
  });

  it('should give an empty excerpt for no text', () => {
    expect(ticketExcerpt(null)).toBe('');
  });
});
