import { ipLocation, publicIp } from './buyer-location';

/** "Vị trí & IP" on the admin order page (vande #058). */
describe('buyer location', () => {
  it('should name the city and the country of a public address', async () => {
    expect(await ipLocation('14.161.22.33')).toBe('Ho Chi Minh City, Vietnam');
    expect(await ipLocation('27.72.100.1')).toBe('Hanoi, Vietnam');
  });

  it('should give the country alone when the city is not known', async () => {
    expect(await ipLocation('8.8.8.8')).toBe('United States');
  });

  it('should not place our own proxy or a private network anywhere', async () => {
    for (const ip of [
      '127.0.0.1',
      '10.0.0.5',
      '172.20.1.1',
      '192.168.1.9',
      '::1',
      'unknown',
      '',
    ]) {
      expect(publicIp(ip)).toBeNull();
      expect(await ipLocation(ip)).toBeNull();
    }
  });

  it('should read an IPv4 address written the IPv6 way', () => {
    expect(publicIp('::ffff:14.161.22.33')).toBe('14.161.22.33');
  });
});
