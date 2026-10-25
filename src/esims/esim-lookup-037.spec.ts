import { EsimsPublicController } from './esims.controller';
import { lookupVoiceAndSms } from './esim-lookup-details';
import { createEsimLookupToken } from './esim-lookup-token';

/**
 * vande #037 — the public lookup page: the plan's minutes / SMS when the
 * supplier reports 0, a refunded eSIM shown as refunded, and the eSIM's full
 * details.
 */
describe('eSIM lookup (vande #037)', () => {
  beforeAll(() => {
    process.env.ESIM_LOOKUP_SECRET = 'test-lookup-secret';
  });

  describe('minutes and SMS', () => {
    it('should fall back to the plan when Airalo answers 0 / 0', () => {
      expect(
        lookupVoiceAndSms(
          { voiceTotal: 0, voiceRemaining: 0, smsTotal: 0, smsRemaining: 0 },
          { call: 200, sms: 200 },
        ),
      ).toEqual({
        callMinutes: 200,
        callMinutesRemaining: null,
        smsCount: 200,
        smsRemaining: null,
      });
    });

    it('should keep the supplier counters when it reports them', () => {
      expect(
        lookupVoiceAndSms(
          {
            voiceTotal: 200,
            voiceRemaining: 150,
            smsTotal: 100,
            smsRemaining: 90,
          },
          { call: 200, sms: 200 },
        ),
      ).toEqual({
        callMinutes: 200,
        callMinutesRemaining: 150,
        smsCount: 100,
        smsRemaining: 90,
      });
    });

    it('should show nothing for a data-only plan', () => {
      expect(lookupVoiceAndSms({}, { call: 0, sms: null })).toEqual({
        callMinutes: null,
        callMinutesRemaining: null,
        smsCount: null,
        smsRemaining: null,
      });
    });
  });

  describe('the lookup reply', () => {
    const plan = {
      name: 'United Kingdom 20GB / 30day',
      standardName: null,
      call: 200,
      sms: 200,
      durationDays: 30,
      operatorName: 'EE',
      speed: '5G',
      apn: 'globaldata',
    };
    const details = [
      {
        orderNumber: 'ORD-1',
        dVi: 'Vương quốc Anh',
        dEn: 'United Kingdom',
        rVi: null,
        rEn: null,
      },
    ];

    function controller(status: string) {
      const esimsService = {
        findByIdWithRelations: jest.fn().mockResolvedValue({
          id: 172,
          iccid: '8900000182754673782',
          status,
          apnValue: null,
          activatedAt: null,
          plan,
        }),
        getDataUsage: jest.fn().mockResolvedValue({
          status: 'ACTIVE',
          isUnlimited: false,
          total: 5120,
          dataUsed: 800,
          remaining: 4320,
          expiredAt: null,
          lastUpdateTime: null,
          voiceTotal: 0,
          voiceRemaining: 0,
          smsTotal: 0,
          smsRemaining: 0,
        }),
      };
      const dataSource = { query: jest.fn().mockResolvedValue(details) };
      return {
        esimsService,
        ctrl: new EsimsPublicController(
          esimsService as never,
          dataSource as never,
        ),
      };
    }

    it('should give the full details and the plan minutes / SMS', async () => {
      const { ctrl } = controller('sold');
      const res = await ctrl.lookupByToken(createEsimLookupToken(172));
      expect(res).toMatchObject({
        iccid: '8900000182754673782',
        orderNumber: 'ORD-1',
        destinationVi: 'Vương quốc Anh',
        destinationEn: 'United Kingdom',
        operatorName: 'EE',
        networkSpeed: '5G',
        apn: 'globaldata',
        refunded: false,
        callMinutes: 200,
        smsCount: 200,
      });
    });

    it('should report a refunded eSIM without asking the supplier', async () => {
      const { ctrl, esimsService } = controller('refunded');
      const res = await ctrl.lookupByToken(createEsimLookupToken(172));
      expect(res).toMatchObject({
        status: 'REFUNDED',
        refunded: true,
        usageAvailable: false,
      });
      expect(esimsService.getDataUsage).not.toHaveBeenCalled();
    });
  });
});
