import { PaymentController } from './payment.controller';

/**
 * doitac-3010 #049 — "Vị trí & IP" was empty on every order: the checkout
 * read `@Ip()`, which behind nginx is always 127.0.0.1. It now reads the
 * address nginx writes into X-Real-IP.
 */
describe('Checkout buyer address (doitac-3010 #049)', () => {
  const req = {
    user: { id: 7 },
    ip: '127.0.0.1',
    headers: { 'x-real-ip': '113.161.95.10' },
  };

  it('should hand the card checkout the address from X-Real-IP', async () => {
    const createCheckout = jest.fn().mockResolvedValue({});
    const controller = new PaymentController({ createCheckout } as never);
    await controller.checkout(req, {} as never, 'UA');
    expect(createCheckout).toHaveBeenCalledWith(7, {}, '113.161.95.10', 'UA');
  });

  it('should hand the bank-transfer checkout the same address', async () => {
    const createBankTransferCheckout = jest.fn().mockResolvedValue({});
    const controller = new PaymentController({
      createBankTransferCheckout,
    } as never);
    await controller.bankTransfer(req, {} as never, 'UA');
    expect(createBankTransferCheckout).toHaveBeenCalledWith(
      7,
      {},
      '113.161.95.10',
      'UA',
    );
  });
});
