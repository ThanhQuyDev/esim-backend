import { WebhooksService } from './webhooks.service';

/**
 * The Gadget Korea eSIM webhook (#028).
 *
 * It saved the eSIM without the topupId and without the expiry it carries. The
 * topupId is what usage queries and top-ups address, so a Gadget Korea eSIM
 * could show no usage and could not be topped up.
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

const PAYLOAD = {
  topupId: 'GK-TOPUP-1',
  optionId: 'opt-1',
  iccid: '8982000000000000001',
  downloadLink: 'LPA:1$smdp.example.com$ACT-CODE',
  expiredDate: '2026-12-31T00:00:00.000Z',
};

describe('Gadget Korea webhook', () => {
  it('should store the topupId and expiry on a new eSIM', async () => {
    const { service, esimsService } = makeService(null);

    await service.handleGadgetKoreaEvent(PAYLOAD);

    expect(esimsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        iccid: PAYLOAD.iccid,
        esimTranNo: 'GK-TOPUP-1',
        expiresAt: new Date(PAYLOAD.expiredDate),
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
      expect.objectContaining({
        esimTranNo: 'GK-TOPUP-1',
        expiresAt: new Date(PAYLOAD.expiredDate),
      }),
    );

    const kept = makeService({ id: 12, esimTranNo: 'EARLIER' });
    await kept.service.handleGadgetKoreaEvent(PAYLOAD);
    expect(kept.esimsService.update).toHaveBeenCalledWith(
      12,
      expect.objectContaining({ esimTranNo: 'EARLIER' }),
    );
  });

  it('should ignore an expiry it cannot read', async () => {
    const { service, esimsService } = makeService(null);

    await service.handleGadgetKoreaEvent({
      ...PAYLOAD,
      expiredDate: 'not-a-date',
    });

    expect(esimsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: null }),
    );
  });
});
