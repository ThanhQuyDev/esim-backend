import { generateOrderNumber, orderNumberTimestamp } from './order-number';

/**
 * Order codes that read as a date and time (#078).
 *
 * `ORD-1790360805694-NZ7UEC` carried a real timestamp that nobody can read, so
 * support had to open the order to find out when it was placed. The replacement
 * has to be readable at a glance and still unique, which is what these tests pin.
 */
describe('order number', () => {
  describe('the timestamp part', () => {
    it('should produce exactly the code in the request', () => {
      // The worked example: 21:08:05.694 on 25/09/2026, Vietnam time.
      const at = new Date('2026-09-25T14:08:05.694Z'); // 21:08:05.694 at UTC+7

      expect(orderNumberTimestamp(at)).toBe('260925210805694');
    });

    it('should read the date in Vietnam time, not the server’s', () => {
      // 18:30 UTC is already the next day in Vietnam. A server running in UTC
      // would otherwise stamp the day before the one the order was placed on.
      expect(orderNumberTimestamp(new Date('2026-09-25T18:30:00.000Z'))).toBe(
        '260926013000000',
      );
    });

    it('should pad every field so the length never changes', () => {
      // 1 January, one minute past midnight: every field is a single digit.
      const at = new Date('2026-01-01T17:01:02.003Z'); // 00:01:02.003 on 02/01 VN

      expect(orderNumberTimestamp(at)).toBe('260102000102003');
      expect(orderNumberTimestamp(at)).toHaveLength(15);
    });

    it('should sort chronologically as plain text', () => {
      // Date first is what makes this work, and it is why the order list can sort
      // on the code itself.
      const earlier = orderNumberTimestamp(
        new Date('2026-09-25T01:00:00.000Z'),
      );
      const later = orderNumberTimestamp(new Date('2026-10-01T01:00:00.000Z'));
      const nextYear = orderNumberTimestamp(
        new Date('2027-01-01T01:00:00.000Z'),
      );

      expect([nextYear, later, earlier].sort()).toEqual([
        earlier,
        later,
        nextYear,
      ]);
    });
  });

  describe('the whole code', () => {
    const at = new Date('2026-09-25T14:08:05.694Z');

    it('should look like the requested shape', () => {
      expect(generateOrderNumber('ORD-', at)).toMatch(
        /^ORD-260925210805694-[0-9A-Z]{6}$/,
      );
    });

    it('should keep the VORD- marker the payment webhook routes on', () => {
      // payment.service checks startsWith(VORD-) to tell a custom payment link
      // apart from a real order.
      const code = generateOrderNumber('VORD-', at);

      expect(code.startsWith('VORD-')).toBe(true);
      expect(code).toMatch(/^VORD-260925210805694-[0-9A-Z]{6}$/);
    });

    it('should always give a full-length suffix', () => {
      // The old `Math.random().toString(36).substring(2, 8)` returned a variable
      // number of characters — 0.5 becomes "0.i", i.e. a one-character tail — so
      // some codes had far less room between them than intended.
      for (let i = 0; i < 500; i += 1) {
        const suffix = generateOrderNumber('ORD-', at).split('-')[2];
        expect(suffix).toHaveLength(6);
        expect(suffix).toMatch(/^[0-9A-Z]{6}$/);
      }
    });

    it('should not repeat itself within one millisecond', () => {
      // Two customers checking out together get the same timestamp, so the tail
      // is what keeps the unique constraint on orderNumber happy.
      const codes = new Set(
        Array.from({ length: 2000 }, () => generateOrderNumber('ORD-', at)),
      );

      // 36^6 ≈ 2.2 billion: a duplicate in 2000 draws would mean the suffix is
      // not actually random.
      expect(codes.size).toBe(2000);
    });
  });
});
