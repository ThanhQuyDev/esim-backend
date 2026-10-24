/**
 * Nhà cung cấp của eSIM nội địa (vande #001).
 *
 * Cùng một nhà mạng có thể bán cả eSIM du lịch lẫn eSIM nội địa — Viettel đang
 * bán cả hai. Trước đây cả hai cùng mang `provider = 'viettel'`, nên mọi bộ lọc
 * theo nhà cung cấp (gói eSIM, quản lý eSIM, đơn hàng, biểu đồ tổng quan) gộp
 * chúng làm một. Gói nội địa nay mang một mã nhà cung cấp riêng, ghép từ mã nhà
 * mạng và hậu tố `-noidia` ("viettel-noidia", "itel-noidia"...), hiển thị là
 * "Viettel nội địa", "iTel nội địa".
 *
 * Đường dẫn trang /esim-noi-dia/[carrier] vẫn dùng mã nhà mạng trần ("itel"),
 * nên có {@link carrierOf} để đi từ mã nhà cung cấp về mã nhà mạng.
 */
export const DOMESTIC_PROVIDER_SUFFIX = '-noidia';

export function isDomesticProvider(provider: string | null | undefined) {
  return (provider ?? '').toLowerCase().endsWith(DOMESTIC_PROVIDER_SUFFIX);
}

/** "itel" → "itel-noidia"; an already-suffixed slug is returned unchanged. */
export function domesticProviderOf(carrier: string): string {
  const slug = carrier.trim().toLowerCase();
  return isDomesticProvider(slug) ? slug : `${slug}${DOMESTIC_PROVIDER_SUFFIX}`;
}

/** "itel-noidia" → "itel"; a travel provider is returned unchanged. */
export function carrierOf(provider: string): string {
  const slug = provider.trim().toLowerCase();
  return isDomesticProvider(slug)
    ? slug.slice(0, -DOMESTIC_PROVIDER_SUFFIX.length)
    : slug;
}

/**
 * What the "eSIM Type" column of the import templates says: `Local` is a
 * domestic eSIM, `Travel` a travel one. Anything else (or a blank cell) is
 * null, so the caller falls back to the button the admin pressed.
 */
export function esimKindFromType(
  value: string | null | undefined,
): 'domestic' | 'travel' | null {
  const v = (value ?? '').trim().toLowerCase();
  if (['local', 'domestic', 'nội địa', 'noi dia', 'noidia'].includes(v))
    return 'domestic';
  if (['travel', 'du lịch', 'du lich', 'roaming'].includes(v)) return 'travel';
  return null;
}
