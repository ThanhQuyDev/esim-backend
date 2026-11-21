import { DeviceCheckStore, SESSION_TTL_MS } from './device-check.store';

/** vande-2011 #031 — QR hand-off from a computer to a phone. */
describe('DeviceCheckStore', () => {
  const result = { state: 'ok' as const, name: 'iPhone' };

  it('should hand one result to the computer, once', () => {
    const store = new DeviceCheckStore();
    const { token } = store.create(0);
    expect(store.read(token, 1)).toEqual({ status: 'waiting' });
    expect(store.submit(token, result, 2)).toBe(true);
    expect(store.submit(token, result, 3)).toBe(false);
    expect(store.read(token, 4)).toEqual({ status: 'done', result });
    expect(store.read(token, 5)).toEqual({ status: 'expired' });
  });

  it('should refuse a token after ten minutes, and an unknown one', () => {
    const store = new DeviceCheckStore();
    const { token } = store.create(0);
    expect(store.submit(token, result, SESSION_TTL_MS + 1)).toBe(false);
    expect(store.read(token, SESSION_TTL_MS + 1)).toEqual({
      status: 'expired',
    });
    expect(store.submit('nope', result, 1)).toBe(false);
  });

  it('should make tokens that cannot be guessed', () => {
    const store = new DeviceCheckStore();
    const a = store.create().token;
    const b = store.create().token;
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(20);
  });
});
