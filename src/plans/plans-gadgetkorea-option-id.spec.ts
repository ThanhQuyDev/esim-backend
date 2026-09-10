import { assertLooksLikeOptionId } from './plans-gadgetkorea-import.service';

/**
 * The Option ID column of the Gadget Korea sheet once shifted onto its
 * neighbour, so every row imported the INITIALIZE_POLICY sentence as its
 * provider plan id. It imported cleanly and gave 1786 plans the same unusable
 * id, which only surfaced much later as a failed recharge.
 */
describe('assertLooksLikeOptionId', () => {
  it('should accept a normal provider option id', () => {
    expect(() => assertLooksLikeOptionId('60MN')).not.toThrow();
    expect(() => assertLooksLikeOptionId('WIN119P')).not.toThrow();
    expect(() => assertLooksLikeOptionId('gk-opt_2024-30d')).not.toThrow();
  });

  it('should reject the mis-mapped INITIALIZE_POLICY text', () => {
    expect(() =>
      assertLooksLikeOptionId(
        'It will be initialized 24 hours after activation.',
      ),
    ).toThrow(/mis-mapped/);
  });

  it('should reject any value containing whitespace or longer than an id', () => {
    expect(() => assertLooksLikeOptionId('60 MN')).toThrow(/mis-mapped/);
    expect(() => assertLooksLikeOptionId('X'.repeat(41))).toThrow(/mis-mapped/);
  });
});
