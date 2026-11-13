import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubmitOrderDto } from './submit-order.dto';

/** SECURITY 12/11/2026 — 1.01 was charged as 1.01 and delivered as 2. */
async function errorsFor(items: unknown) {
  const dto = plainToInstance(SubmitOrderDto, { currency: 'VND', items });
  const errors = await validate(dto);
  return JSON.stringify(errors);
}

describe('SubmitOrderDto quantities', () => {
  it('should accept whole numbers', async () => {
    expect(await errorsFor([{ planId: 1, quantity: 2, periodNum: 7 }])).toBe(
      '[]',
    );
  });

  it('should refuse a fractional quantity or day count', async () => {
    expect(await errorsFor([{ planId: 1, quantity: 1.01 }])).toContain('isInt');
    expect(
      await errorsFor([{ planId: 1, quantity: 1, periodNum: 2.5 }]),
    ).toContain('isInt');
  });

  it('should refuse an order with no items', async () => {
    expect(await errorsFor([])).toContain('arrayMinSize');
  });
});
