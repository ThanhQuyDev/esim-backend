import { lpaOf, nonEmpty, normalizeLpa } from './lpa';

/** vande-2011 #004: an eSIM had no LPA / QR although the supplier had both. */
describe('LPA from what a supplier sent (vande-2011 #004)', () => {
  it('should keep a plain LPA', () => {
    expect(
      normalizeLpa('LPA:1$rsp.esim.pub$8C28C4333989B5ACC12C059F65C95B66'),
    ).toBe('LPA:1$rsp.esim.pub$8C28C4333989B5ACC12C059F65C95B66');
  });

  it("should read the LPA out of MicroEsim's HTML block", () => {
    const html =
      '<br>ICCID: 89862105740200034545<br>SM-DP+Address: rsp.esim.pub<br>' +
      'Activation Code: 8C28C4333989B5ACC12C059F65C95B66<br>' +
      'LPA:1$rsp.esim.pub$8C28C4333989B5ACC12C059F65C95B66';
    expect(normalizeLpa(html)).toBe(
      'LPA:1$rsp.esim.pub$8C28C4333989B5ACC12C059F65C95B66',
    );
  });

  it('should build it from the labelled parts when there is no LPA line', () => {
    expect(
      normalizeLpa(
        '<br>SM-DP+Address: rsp1.cmlink.com<br>Activation Code: A16C71',
      ),
    ).toBe('LPA:1$rsp1.cmlink.com$A16C71');
  });

  it('should say nothing for an empty answer, so it never wipes a good LPA', () => {
    expect(normalizeLpa('')).toBeNull();
    expect(normalizeLpa('   ')).toBeNull();
    expect(normalizeLpa(null)).toBeNull();
    expect(nonEmpty('')).toBeNull();
    expect(nonEmpty(' https://x/q.png ')).toBe('https://x/q.png');
  });

  it('should rebuild the LPA from the stored address and code', () => {
    expect(
      lpaOf({ lpa: '', smdpAddress: 'rsp.esim.pub', activationCode: '8C28' }),
    ).toBe('LPA:1$rsp.esim.pub$8C28');
    expect(
      lpaOf({ lpa: null, smdpAddress: null, activationCode: '8C28' }),
    ).toBeNull();
  });
});
