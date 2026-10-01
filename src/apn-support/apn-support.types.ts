/**
 * Which apps work on a given APN (#065, #066).
 *
 * China blocks TikTok and ChatGPT, and whether an eSIM gets around that depends
 * on the APN its traffic exits through. The answer is not ours to compute: it is
 * a lookup table the team maintains and uploads as an Excel sheet, because it
 * changes as carriers change their routing.
 *
 * Every app is tracked per device platform, because the real sheet is: the same
 * `cmhk` APN runs TikTok on an iPhone and not on an Android. (The first cut of
 * this stored one shared answer for ChatGPT, written from a description of the
 * sheet; the sheet itself — received 02/10/2026 — splits all four apps by
 * device, so it does too.)
 */

/** The device platforms the sheet distinguishes. */
export const DEVICE_PLATFORMS = ['ios', 'android'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

/** The apps the sheet tracks, in the order they appear in it. */
export const TRACKED_APPS = ['tiktok', 'chatGpt', 'gemini', 'claude'] as const;
export type TrackedApp = (typeof TRACKED_APPS)[number];

/** Whether one app works, per device. */
export type AppSupportByDevice = { ios: boolean; android: boolean };

/** What one APN supports, app by app. */
export type ApnCapabilities = Record<TrackedApp, AppSupportByDevice>;

/** Nothing known about an APN reads as "no" everywhere — never as "yes". */
export function emptyCapabilities(): ApnCapabilities {
  return {
    tiktok: { ios: false, android: false },
    chatGpt: { ios: false, android: false },
    gemini: { ios: false, android: false },
    claude: { ios: false, android: false },
  };
}

/**
 * APNs are compared case-insensitively and trimmed: they arrive from supplier
 * APIs and from a hand-maintained spreadsheet, so "CMHK " and "cmhk" are the same
 * APN and must not be two rows.
 */
export function normalizeApn(apn: string | null | undefined): string | null {
  const trimmed = apn?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

/**
 * Whether an app works on BOTH platforms — the only claim that holds for a
 * customer whose device we do not know.
 *
 * #064 asks for plans that work "100%", and the storefront does not know what the
 * visitor is holding, so "works on one platform" is not an answer we can put
 * behind a filter.
 */
export function worksOnEveryDevice(support: AppSupportByDevice): boolean {
  return support.ios && support.android;
}
