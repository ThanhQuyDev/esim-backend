import {
  UnprocessableEntityException,
  NotFoundException,
} from '@nestjs/common';
import { CustomPaymentLinksService } from './custom-payment-links.service';
import {
  CustomPaymentLinkStatus,
  CUSTOM_PAYMENT_LINK_EXPIRY_MINUTES,
} from './custom-payment-links.enum';

/**
 * #056 — a custom payment link only ever left "Chờ thanh toán" if OnePay's IPN
 * arrived. An admin can now say what happened, and a sweep expires links nobody
 * paid within OnePay's 30-minute window.
 *
 * Every test here is about not rewriting a money record by accident: the sweep
 * must not overrule the gateway, the gateway must not overrule an admin, and a
 * late success must still be honoured when all that happened was a timeout.
 */
describe('Custom payment link confirmation (#056)', () => {
  function makeService(link: Record<string, unknown> | null) {
    const updates: Record<string, unknown>[] = [];

    const repository = {
      findById: jest.fn().mockResolvedValue(link),
      findByVirtualOrderId: jest.fn().mockResolvedValue(link),
      update: jest.fn((_id: unknown, payload: Record<string, unknown>) => {
        updates.push(payload);
        return Promise.resolve({ ...link, ...payload });
      }),
      expirePendingCreatedBefore: jest.fn().mockResolvedValue(3),
    };

    const service = Object.create(
      CustomPaymentLinksService.prototype,
    ) as CustomPaymentLinksService;
    const internals = service as unknown as Record<string, unknown>;
    internals.customPaymentLinkRepository = repository;
    internals.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

    return { service, repository, updates };
  }

  function pending(over: Record<string, unknown> = {}) {
    return {
      id: 'link-1',
      virtualOrderId: 'VORD-1',
      status: CustomPaymentLinkStatus.PENDING,
      confirmedAt: null,
      expiredAt: null,
      ...over,
    };
  }

  describe('manual confirmation', () => {
    it('should marks a pending link paid, recording who and when', async () => {
      const { service, updates } = makeService(pending());

      await service.confirmManually('link-1', true, 42);

      expect(updates[0]).toMatchObject({
        status: CustomPaymentLinkStatus.PAID,
        confirmedByAdminId: 42,
        expiredAt: null,
      });
      expect(updates[0].confirmedAt).toBeInstanceOf(Date);
    });

    it('should marks a pending link failed', async () => {
      const { service, updates } = makeService(pending());

      await service.confirmManually('link-1', false, 42);

      expect(updates[0]).toMatchObject({
        status: CustomPaymentLinkStatus.FAILED,
      });
    });

    it('should can still correct a link the sweep auto-expired', async () => {
      // The customer did pay, just not before the timeout was noticed.
      const { service, updates } = makeService(
        pending({
          status: CustomPaymentLinkStatus.FAILED,
          expiredAt: new Date(),
        }),
      );

      await service.confirmManually('link-1', true, 7);

      expect(updates[0]).toMatchObject({
        status: CustomPaymentLinkStatus.PAID,
        // An admin's word replaces the sweep's guess, so it no longer reads as
        // "expired".
        expiredAt: null,
      });
    });

    it('should refuses to overwrite a link OnePay already settled', async () => {
      const { service, repository } = makeService(
        pending({ status: CustomPaymentLinkStatus.PAID }),
      );

      await expect(
        service.confirmManually('link-1', false, 7),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should refuses to overwrite a real gateway failure', async () => {
      // FAILED with no `expiredAt` means OnePay declined it, not a timeout.
      const { service, repository } = makeService(
        pending({ status: CustomPaymentLinkStatus.FAILED, expiredAt: null }),
      );

      await expect(
        service.confirmManually('link-1', true, 7),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("should refuses to overwrite another admin's confirmation", async () => {
      const { service, repository } = makeService(
        pending({
          status: CustomPaymentLinkStatus.FAILED,
          expiredAt: new Date(),
          confirmedAt: new Date(),
        }),
      );

      await expect(
        service.confirmManually('link-1', true, 7),
      ).rejects.toThrow();
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should 404s for a link that does not exist', async () => {
      const { service } = makeService(null);

      await expect(
        service.confirmManually('nope', true, 7),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('auto-expiry sweep', () => {
    it('should expires links older than the OnePay window', async () => {
      const { service, repository } = makeService(pending());
      const before = Date.now();

      const expired = await service.expireStaleLinks();

      expect(expired).toBe(3);
      const cutoff = repository.expirePendingCreatedBefore.mock
        .calls[0][0] as Date;
      const expectedMs =
        before - CUSTOM_PAYMENT_LINK_EXPIRY_MINUTES * 60 * 1000;
      // Within a second of "now minus the window".
      expect(Math.abs(cutoff.getTime() - expectedMs)).toBeLessThan(1000);
    });

    it('should use 30 minutes, matching OnePay', () => {
      expect(CUSTOM_PAYMENT_LINK_EXPIRY_MINUTES).toBe(30);
    });
  });

  describe('a late IPN', () => {
    it('should promotes an auto-expired link when OnePay reports success', async () => {
      // Money really arrived; the sweep only guessed from silence.
      const { service, updates } = makeService(
        pending({
          status: CustomPaymentLinkStatus.FAILED,
          expiredAt: new Date(),
        }),
      );

      await service.finalizeFromIpn('VORD-1', {
        isSuccess: true,
        paymentId: 'TX-9',
      });

      expect(updates[0]).toMatchObject({
        status: CustomPaymentLinkStatus.PAID,
        paymentId: 'TX-9',
        expiredAt: null,
      });
    });

    it('should leaves an auto-expired link alone when OnePay reports failure', async () => {
      const { service, repository } = makeService(
        pending({
          status: CustomPaymentLinkStatus.FAILED,
          expiredAt: new Date(),
        }),
      );

      await service.finalizeFromIpn('VORD-1', { isSuccess: false });

      expect(repository.update).not.toHaveBeenCalled();
    });

    it("should never overturns an admin's confirmation", async () => {
      const { service, repository } = makeService(
        pending({
          status: CustomPaymentLinkStatus.FAILED,
          expiredAt: new Date(),
          confirmedAt: new Date(),
        }),
      );

      await service.finalizeFromIpn('VORD-1', { isSuccess: true });

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should stays idempotent for an already paid link', async () => {
      const { service, repository } = makeService(
        pending({ status: CustomPaymentLinkStatus.PAID }),
      );

      await service.finalizeFromIpn('VORD-1', { isSuccess: true });

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should still settles a pending link the normal way', async () => {
      const { service, updates } = makeService(pending());

      await service.finalizeFromIpn('VORD-1', {
        isSuccess: true,
        paymentId: 'TX-1',
      });

      expect(updates[0]).toMatchObject({
        status: CustomPaymentLinkStatus.PAID,
        paymentId: 'TX-1',
      });
      // Not an expiry promotion, so it does not touch `expiredAt`.
      expect(updates[0].expiredAt).toBeUndefined();
    });
  });
});
