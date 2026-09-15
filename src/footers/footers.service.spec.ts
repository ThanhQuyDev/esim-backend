import { FootersService } from './footers.service';
import { FooterRepository } from './infrastructure/persistence/footer.repository';

describe('FootersService', () => {
  const repository = {
    create: jest.fn(),
    update: jest.fn(),
  } as unknown as jest.Mocked<FooterRepository>;
  const service = new FootersService(repository);

  beforeEach(() => jest.clearAllMocks());

  // The CMS sends the Vietnamese column heading, but the payloads listed every
  // field except this one, so it was silently dropped and the Vietnamese site
  // kept showing English headings.
  it('should save categoriesVi on create', async () => {
    await service.create({
      categories: 'Help',
      categoriesVi: 'Trợ giúp',
      url: '/ho-tro',
      title: 'Help',
      titleVi: 'Trợ giúp',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ categoriesVi: 'Trợ giúp' }),
    );
  });

  // #043: the English site links to its own URLs.
  it('should save urlEn on create and update', async () => {
    await service.create({
      url: 'https://esim.vn/ho-tro',
      urlEn: 'https://esim.vn/en/help',
      title: 'Help',
      titleVi: 'Trợ giúp',
    });
    await service.update('id-1', { urlEn: 'https://esim.vn/en/support' });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ urlEn: 'https://esim.vn/en/help' }),
    );
    expect(repository.update).toHaveBeenCalledWith(
      'id-1',
      expect.objectContaining({ urlEn: 'https://esim.vn/en/support' }),
    );
  });

  it('should save categoriesVi on update', async () => {
    await service.update('id-1', { categoriesVi: 'Theo dõi' });

    expect(repository.update).toHaveBeenCalledWith(
      'id-1',
      expect.objectContaining({ categoriesVi: 'Theo dõi' }),
    );
  });
});
