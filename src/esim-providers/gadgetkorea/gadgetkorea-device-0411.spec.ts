import { of } from 'rxjs';
import {
  gadgetKoreaDeviceFacts,
  GadgetKoreaService,
} from './gadgetkorea.service';

describe('Gadget Korea device (vande-0411 #036)', () => {
  it('should read installTime as UTC', () => {
    expect(
      gadgetKoreaDeviceFacts({
        installTime: '2026-11-03 17:25:43',
        installDevice: ' iPhone 13 ',
        eid: '89049032',
      }),
    ).toEqual({
      installedAt: '2026-11-03T17:25:43.000Z',
      eid: '89049032',
      deviceModel: 'iPhone 13',
    });
  });

  it('should know nothing before the eSIM is installed', () => {
    expect(gadgetKoreaDeviceFacts(null)).toEqual({});
  });

  function service(body: unknown) {
    const get = jest.fn().mockReturnValue(of({ data: body }));
    const svc = Object.create(
      GadgetKoreaService.prototype,
    ) as GadgetKoreaService;
    Object.assign(svc, {
      httpService: { get },
      configService: {
        getOrThrow: (key: string) =>
          key.endsWith('baseUrl') ? 'https://api.test' : 'c2VjcmV0',
      },
    });
    return { svc, get };
  }

  it('should ask the documented path, signed on it', async () => {
    const { svc, get } = service({ code: '0000', device: { eid: 'E' } });

    await expect(svc.getDeviceInfo('8985')).resolves.toEqual({ eid: 'E' });

    const [url, options] = get.mock.calls[0];
    expect(url).toBe('https://api.test/api/v2/iccid/8985/device');
    expect(options.headers['x-gat-signature']).toBeTruthy();
  });

  it('should read "ICCID not found" as nothing known yet', async () => {
    const { svc } = service({ code: '9001', message: 'ICCID not found' });

    await expect(svc.getDeviceInfo('8985')).resolves.toBeNull();
  });
});
