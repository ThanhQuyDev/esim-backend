import {
  buildTransferMemo,
  buildVietQrUrl,
  extractBankTransferCode,
} from './bank-transfer.util';

/**
 * SePay only picks up a transfer into a personal VietinBank account when its
 * memo contains "SEVQR". Without it the money lands, SePay never lists the
 * transaction and no webhook comes, so every order expired unpaid.
 */
describe('Bank-transfer memo', () => {
  it('should put SEVQR before our code', () => {
    expect(buildTransferMemo('ESIM4CD3RB', 'SEVQR')).toBe('SEVQR ESIM4CD3RB');
  });

  it('should be the bare code when no prefix is set', () => {
    expect(buildTransferMemo('ESIM4CD3RB', '')).toBe('ESIM4CD3RB');
    expect(buildTransferMemo('ESIM4CD3RB', '  ')).toBe('ESIM4CD3RB');
  });

  it('should still find our code in the memo as the bank sends it back', () => {
    for (const content of [
      'SEVQR ESIM4CD3RB',
      'SEVQRESIM4CD3RB',
      'sevqr esim4cd3rb',
      'NGUYEN VAN A chuyen tien SEVQR ESIM4CD3RB FT26295',
    ]) {
      expect(extractBankTransferCode(content)).toBe('ESIM4CD3RB');
    }
  });

  it('should pre-fill the full memo in the VietQR image', () => {
    const url = new URL(
      buildVietQrUrl({
        bankCode: 'VietinBank',
        accountNumber: '123',
        accountName: 'A',
        amountVnd: 179000,
        transferCode: buildTransferMemo('ESIM4CD3RB', 'SEVQR'),
      }),
    );
    expect(url.searchParams.get('addInfo')).toBe('SEVQR ESIM4CD3RB');
  });
});
