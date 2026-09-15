import { HeroBannersService } from './hero-banners.service';
import { HeroBannerRepository } from './infrastructure/persistence/hero-banner.repository';

/**
 * #046 — "Đã thay ảnh hero mới nhưng chưa thấy hiện ngoài trang".
 *
 * The CMS uploads the picture and sends its URL, but the service built the
 * repository payload field by field and `image` was not one of them, so the
 * column stayed empty and the storefront fell back to its built-in picture.
 */
describe('HeroBannersService image', () => {
  const repository = {
    create: jest.fn(),
    update: jest.fn(),
  } as unknown as jest.Mocked<HeroBannerRepository>;
  const service = new HeroBannersService(repository);

  const banner = {
    active: true,
    title: 'eSIM du lịch',
    firstIcon: 'https://cdn/1.svg',
    firstContent: 'Tặng 10.000đ',
    secondIcon: 'https://cdn/2.svg',
    secondContent: 'Hoàn tiền 2%',
    description: 'Mô tả',
    language: 'vi',
  };

  beforeEach(() => jest.clearAllMocks());

  it('should save the hero image on create', async () => {
    await service.create({ ...banner, image: 'https://cdn/hero.png' });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ image: 'https://cdn/hero.png' }),
    );
  });

  it('should save the hero image on update', async () => {
    await service.update('hero-1', { image: 'https://cdn/new-hero.png' });

    expect(repository.update).toHaveBeenCalledWith(
      'hero-1',
      expect.objectContaining({ image: 'https://cdn/new-hero.png' }),
    );
  });

  it('should clear the image when the admin empties it', async () => {
    await service.update('hero-1', { image: '' });

    expect(repository.update).toHaveBeenCalledWith(
      'hero-1',
      expect.objectContaining({ image: null }),
    );
  });

  it('should keep the image when an update does not mention it', async () => {
    await service.update('hero-1', { active: false });

    const payload = repository.update.mock.calls[0][1];
    expect(payload).not.toHaveProperty('image');
  });
});
