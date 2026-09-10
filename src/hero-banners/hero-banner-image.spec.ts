import { HeroBannerMapper } from './infrastructure/persistence/relational/mappers/hero-banner.mapper';
import { HeroBannerEntity } from './infrastructure/persistence/relational/entities/hero-banner.entity';
import { HeroBanner } from './domain/hero-banner';

/**
 * Admin-chosen hero image (#089).
 *
 * The storefront hero has always read `banner.image` and fallen back to a
 * built-in picture — but the column did not exist, so the fallback was the only
 * image the site could ever show and changing the hero meant a deploy.
 *
 * The mapper is where that field lives or dies: drop it in either direction and
 * the CMS appears to save an image that never comes back.
 */
describe('hero banner image', () => {
  function entity(overrides: Partial<HeroBannerEntity> = {}): HeroBannerEntity {
    return Object.assign(new HeroBannerEntity(), {
      id: 'hero-1',
      active: true,
      title: 'eSIM cho mọi chuyến đi',
      firstIcon: 'https://cdn/1.svg',
      firstContent: 'Kích hoạt tức thì',
      secondIcon: 'https://cdn/2.svg',
      secondContent: 'Phủ sóng 190 quốc gia',
      description: 'Mua eSIM trong 2 phút',
      language: 'vi',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
  }

  it('should carry the image out to the API', () => {
    const domain = HeroBannerMapper.toDomain(
      entity({ image: 'https://cdn.example/hero.png' }),
    );

    expect(domain.image).toBe('https://cdn.example/hero.png');
  });

  it('should save the image the admin picked', () => {
    const domain = Object.assign(new HeroBanner(), {
      ...HeroBannerMapper.toDomain(entity()),
      image: 'https://cdn.example/new-hero.png',
    });

    expect(HeroBannerMapper.toPersistence(domain).image).toBe(
      'https://cdn.example/new-hero.png',
    );
  });

  it('should report no image as null, so the site uses its built-in one', () => {
    // Every banner that exists today is in this state; none of them may break.
    expect(HeroBannerMapper.toDomain(entity()).image).toBeNull();

    const domain = HeroBannerMapper.toDomain(entity());
    expect(HeroBannerMapper.toPersistence(domain).image).toBeNull();
  });

  it('should keep the rest of the banner untouched', () => {
    const domain = HeroBannerMapper.toDomain(
      entity({ image: 'https://cdn.example/hero.png' }),
    );

    expect(domain.title).toBe('eSIM cho mọi chuyến đi');
    expect(domain.firstContent).toBe('Kích hoạt tức thì');
    expect(domain.secondContent).toBe('Phủ sóng 190 quốc gia');
    expect(domain.language).toBe('vi');
    expect(domain.active).toBe(true);
  });
});
