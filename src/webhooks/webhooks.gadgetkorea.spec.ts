import { WebhooksService } from './webhooks.service';

/**
 * The Gadget Korea eSIM webhook (#028).
 *
 * It saved the eSIM without the topupId. The topupId is what usage queries and
 * top-ups address, so a Gadget Korea eSIM could show no usage and could not be
 * topped up. `expiredDate` is the install-by date, not the plan end, and must
 * not become the eSIM's expiry.
 */

function makeService(existing: Record<string, unknown> | null) {
  const service = Object.create(WebhooksService.prototype) as WebhooksService;
  const internals = service as unknown as Record<string, unknown>;

  const esimsService = {
    findByIccid: jest.fn().mockResolvedValue(existing),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn().mockResolvedValue({ id: 1 }),
  };

  internals.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  internals.esimsService = esimsService;
  internals.orderItemsService = {
    findByOrderRequestId: jest
      .fn()
      .mockResolvedValue([{ id: 5, planId: 9, orderId: 3 }]),
    update: jest.fn().mockResolvedValue(undefined),
  };
  internals.ordersService = {
    findById: jest.fn().mockResolvedValue({ userId: 7 }),
  };
  internals.sendPurchaseEmailAfterWebhook = jest
    .fn()
    .mockResolvedValue(undefined);

  return { service, esimsService };
}

// Shape from the Usimsa Partner API (v2) "eSIM Callback Notification" docs.
const PAYLOAD = {
  topupId: 'GK-TOPUP-1',
  optionId: 'opt-1',
  iccid: '8982000000000000001',
  smdp: 'usimsa.com',
  activateCode: 'ACT-CODE',
  downloadLink: 'LPA:$usimsa.com$ACT-CODE',
  qrcodeImgUrl: 'https://issue.usimsa.com/api/iccid/qrcode/x/120',
  expiredDate: '2025-03-08',
};

describe('Gadget Korea webhook', () => {
  it('should store the topupId on a new eSIM', async () => {
    const { service, esimsService } = makeService(null);

    await service.handleGadgetKoreaEvent(PAYLOAD);

    expect(esimsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        iccid: PAYLOAD.iccid,
        esimTranNo: 'GK-TOPUP-1',
        smdpAddress: 'usimsa.com',
        activationCode: 'ACT-CODE',
        qrcode: PAYLOAD.qrcodeImgUrl,
        provider: 'gadgetkorea',
        userId: 7,
        orderItemId: 5,
      }),
    );
  });

  it('should fill the topupId into an existing eSIM without overwriting one it has', async () => {
    const { service, esimsService } = makeService({
      id: 11,
      esimTranNo: null,
    });

    await service.handleGadgetKoreaEvent(PAYLOAD);

    expect(esimsService.update).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ esimTranNo: 'GK-TOPUP-1' }),
    );

    const kept = makeService({ id: 12, esimTranNo: 'EARLIER' });
    await kept.service.handleGadgetKoreaEvent(PAYLOAD);
    expect(kept.esimsService.update).toHaveBeenCalledWith(
      12,
      expect.objectContaining({ esimTranNo: 'EARLIER' }),
    );
  });

  it('should not take the install-by date as the plan expiry', async () => {
    const created = makeService(null);
    await created.service.handleGadgetKoreaEvent(PAYLOAD);
    expect(created.esimsService.create.mock.calls[0][0]).not.toHaveProperty(
      'expiresAt',
    );

    const updated = makeService({ id: 11, esimTranNo: null });
    await updated.service.handleGadgetKoreaEvent(PAYLOAD);
    expect(updated.esimsService.update.mock.calls[0][1]).not.toHaveProperty(
      'expiresAt',
    );
  });

  it('should accept the qrCodeImgUrl spelling', async () => {
    const { service, esimsService } = makeService(null);
    const { qrcodeImgUrl, ...rest } = PAYLOAD;

    await service.handleGadgetKoreaEvent({
      ...rest,
      qrCodeImgUrl: qrcodeImgUrl,
    });

    expect(esimsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ qrcode: qrcodeImgUrl }),
    );
  });
});
