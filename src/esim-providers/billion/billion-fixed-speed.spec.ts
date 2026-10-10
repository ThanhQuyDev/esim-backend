import { billionFixedNameSpeed } from './billion-catalogue';

/**
 * #046 (test round 4) — the speed after the quota on a fixed Billion plan is
 * written in its name, and F002 can contradict it: "China Mainland(Multi)-1GB,
 * 128kbps" came back as 384kbps, so it tied with "China-SGIP-1GB,384kbps" and
 * the slower plan could win.
 */
describe('billionFixedNameSpeed (#046)', () => {
  it.each([
    ['China Mainland(Multi)-1GB,128kbps - 3 days', 128],
    ['China-SGIP-1GB,384kbps - 3 days', 384],
    ['Japan-3GB, 1Mbps', 1024],
    ['China Mainland-China Mobile-1GB/Natural Day - 7 days', null],
  ])('should read %s as %s kbps', (name, expected) => {
    expect(billionFixedNameSpeed(name)).toBe(expected);
  });
});
