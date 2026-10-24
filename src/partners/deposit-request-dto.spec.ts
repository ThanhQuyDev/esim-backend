import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDepositRequestDto } from './dto/admin-partner.dto';

/**
 * Nạp tiền ký quỹ dưới 100.000đ (vande #008): the admin set a 10.000đ minimum
 * for a distributor, and the request was refused before reaching it —
 * "amountVnd must not be less than 100000". The limits live on the partner and
 * the programme settings; the DTO only checks the shape.
 */
describe('CreateDepositRequestDto (vande #008)', () => {
  const errorsFor = (amountVnd: unknown) =>
    validate(plainToInstance(CreateDepositRequestDto, { amountVnd }));

  it('should accept an amount below the old fixed 100.000đ floor', async () => {
    expect(await errorsFor(10_000)).toHaveLength(0);
  });

  it('should accept an amount above the old fixed 10 triệu ceiling', async () => {
    expect(await errorsFor(50_000_000)).toHaveLength(0);
  });

  it('should still refuse zero, negatives and fractions', async () => {
    expect(await errorsFor(0)).not.toHaveLength(0);
    expect(await errorsFor(-5)).not.toHaveLength(0);
    expect(await errorsFor(10_000.5)).not.toHaveLength(0);
  });
});
