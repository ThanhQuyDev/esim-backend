import {
  billionTimeline,
  esimAccessTimeToIso,
  esimAccessTimeline,
  microEsimTimeline,
  sizeToMb,
  utc8ToIso,
} from './provider-timeline';

/**
 * Mốc thời gian, EID, thiết bị từ API nhà cung cấp (vande #011). Dữ liệu là
 * câu trả lời thật của từng nhà cung cấp (đọc 25/10/2026).
 */
describe('Mốc thời gian eSIM từ nhà cung cấp (vande #011)', () => {
  it('should read eSIM Access /esim/query (ICCID 8948010010047313209)', () => {
    const facts = esimAccessTimeline({
      iccid: '8948010010047313209',
      eid: '89049032007208882600178564633538',
      activateTime: '2026-10-23T12:15:54+0000',
      expiredTime: '2026-11-22T12:15:54+0000',
      installationTime: '2026-10-23T03:10:43+0000',
    });
    expect(facts).toEqual({
      installedAt: '2026-10-23T03:10:43.000Z',
      activatedAt: '2026-10-23T12:15:54.000Z',
      expiredAt: '2026-11-22T12:15:54.000Z',
      eid: '89049032007208882600178564633538',
    });
    expect(esimAccessTimeToIso('')).toBeNull();
  });

  it('should read MicroEsim events and its UTC+8 clock', () => {
    expect(
      microEsimTimeline([
        {
          event_date: '2026-10-20 10:09:15',
          eid: '89049032020008884800241111101363',
          device_model: 'iPhone 17 Pro Max',
          notify_type: 'DISABLED',
        },
      ]),
    ).toEqual({
      installedAt: '2026-10-20T02:09:15.000Z',
      eid: '89049032020008884800241111101363',
      deviceModel: 'iPhone 17 Pro Max',
    });
    // deviceDetail active_time / expire_time
    expect(utc8ToIso('2026-10-20 10:18:27')).toBe('2026-10-20T02:18:27.000Z');
    expect(microEsimTimeline([])).toEqual({});
  });

  it('should prefer the ENABLED event as the install moment', () => {
    expect(
      microEsimTimeline([
        { event_date: '2026-10-20 11:00:00', notify_type: 'DISABLED' },
        { event_date: '2026-10-20 10:00:00', notify_type: 'ENABLED' },
      ]).installedAt,
    ).toBe('2026-10-20T02:00:00.000Z');
  });

  it('should take the first download / install of Billion F042', () => {
    expect(
      billionTimeline([
        {
          orderId: 'o',
          iccid: 'i',
          status: '3',
          recordTime: '2026-10-19 18:42:54',
          eid: 'E1',
        },
        {
          orderId: 'o',
          iccid: 'i',
          status: '2',
          recordTime: '2026-10-19 18:41:36',
          eid: 'E1',
        },
        {
          orderId: 'o',
          iccid: 'i',
          status: '2',
          recordTime: '2026-10-19 18:41:38',
          eid: 'E1',
        },
      ]),
    ).toEqual({ installedAt: '2026-10-19T10:41:36.000Z', eid: 'E1' });
    expect(billionTimeline([])).toEqual({ installedAt: null, eid: null });
  });

  it('should read MicroEsim usage strings in MB', () => {
    expect(sizeToMb('68.02 MB')).toBeCloseTo(68.02);
    expect(sizeToMb('1.5 GB')).toBe(1536);
    expect(sizeToMb('')).toBe(0);
  });
});
