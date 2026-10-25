/**
 * The blog's categories, made in advance for authors to pick from (vande
 * #076): outside writers do not know the site's sections, so the CMS offers
 * these instead of a free-text box. A post stores the name in its own
 * language; the storefront builds the category URL from that name, so the
 * slugs here are the same transform of each name.
 */
export type BlogCategorySeed = {
  en: string;
  vi: string;
  children: { en: string; vi: string }[];
};

export const BLOG_CATEGORY_SEED: BlogCategorySeed[] = [
  {
    en: 'Mobile Connectivity',
    vi: 'Kết nối di động',
    children: [
      { en: 'eSIMs', vi: 'eSIM' },
      { en: 'Roaming', vi: 'Roaming' },
      { en: 'Physical SIM', vi: 'SIM vật lý' },
      { en: 'Pocket Wi-Fi', vi: 'Pocket Wi-Fi' },
      { en: 'Apps', vi: 'Ứng dụng' },
      { en: 'Internet Access', vi: 'Kết nối internet' },
    ],
  },
  {
    en: 'Devices',
    vi: 'Thiết bị',
    children: [
      { en: 'iOS', vi: 'iOS' },
      { en: 'Android', vi: 'Android' },
    ],
  },
  {
    en: 'Travel',
    vi: 'Du lịch',
    children: [
      { en: 'Travel Guides', vi: 'Cẩm nang du lịch' },
      { en: 'Best Time to Visit', vi: 'Thời điểm đi' },
      { en: 'Trip Planning', vi: 'Lên kế hoạch' },
      { en: 'Safety', vi: 'An toàn' },
      { en: 'Getting Around', vi: 'Di chuyển' },
      { en: 'Food', vi: 'Ẩm thực' },
      { en: 'Events', vi: 'Sự kiện' },
      { en: 'Digital Nomad', vi: 'Làm việc từ xa' },
    ],
  },
  {
    en: 'Reviews & Comparisons',
    vi: 'Đánh giá & so sánh',
    children: [
      { en: 'Comparisons', vi: 'So sánh' },
      { en: 'Reviews', vi: 'Đánh giá' },
      { en: 'What’s New', vi: 'Tính năng mới' },
    ],
  },
  {
    en: 'Insights',
    vi: 'Phân tích',
    children: [
      { en: 'News', vi: 'Tin tức' },
      { en: 'Research', vi: 'Nghiên cứu' },
    ],
  },
];

/**
 * A category name as a URL part — the storefront's `categorySlug`, so a
 * category page found from either side has the same address.
 */
export function blogCategorySlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
