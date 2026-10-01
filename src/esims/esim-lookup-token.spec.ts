import {
  createEsimLookupToken,
  maskIccid,
  parseEsimLookupToken,
} from './esim-lookup-token';

describe('esim lookup token (#003)', () => {
  const originalSecret = process.env.ESIM_LOOKUP_SECRET;

  beforeAll(() => {
    process.env.ESIM_LOOKUP_SECRET = 'test-lookup-secret';
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.ESIM_LOOKUP_SECRET;
    else process.env.ESIM_LOOKUP_SECRET = originalSecret;
  });

  it('should round-trips the eSIM id', () => {
    const token = createEsimLookupToken(4321);
    expect(parseEsimLookupToken(token)).toBe(4321);
  });

  it('should never carries the ICCID', () => {
    // The whole point of the token: the link is forwarded to family, and an
    // ICCID is enough to order a topup on someone else's eSIM.
    const token = createEsimLookupToken(7);
    expect(token).not.toContain('8901234567890123456');
    const payload = Buffer.from(token.split('.')[0], 'base64url').toString();
    expect(payload).not.toMatch(/890123/);
  });

  it('should rejects a forged signature', () => {
    const token = createEsimLookupToken(9);
    const [payload] = token.split('.');
    expect(
      parseEsimLookupToken(`${payload}.aaaaaaaaaaaaaaaaaaaaaa`),
    ).toBeNull();
  });

  it('should rejects a swapped payload under the old signature', () => {
    const token = createEsimLookupToken(9);
    const [, signature] = token.split('.');
    const otherPayload = Buffer.from(JSON.stringify({ e: 10, t: 1 })).toString(
      'base64url',
    );
    expect(parseEsimLookupToken(`${otherPayload}.${signature}`)).toBeNull();
  });

  it('should rejects junk instead of throwing', () => {
    expect(parseEsimLookupToken(undefined)).toBeNull();
    expect(parseEsimLookupToken('')).toBeNull();
    expect(parseEsimLookupToken('nodot')).toBeNull();
    expect(parseEsimLookupToken('a.b')).toBeNull();
  });

  it('should signs with the secret, so another deployment cannot mint tokens', () => {
    const token = createEsimLookupToken(5);
    process.env.ESIM_LOOKUP_SECRET = 'a-different-secret';
    try {
      expect(parseEsimLookupToken(token)).toBeNull();
    } finally {
      process.env.ESIM_LOOKUP_SECRET = 'test-lookup-secret';
    }
  });

  it('should masks all but the last four digits of the ICCID', () => {
    expect(maskIccid('8901234567890123456')).toBe('•••••••••••••••3456');
    expect(maskIccid(null)).toBeNull();
  });
});
