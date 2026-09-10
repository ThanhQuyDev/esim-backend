import { FooterMapper } from './footer.mapper';
import { FooterEntity } from '../entities/footer.entity';

describe('FooterMapper sort order', () => {
  it('should map sortOrder between persistence and domain', () => {
    const entity = Object.assign(new FooterEntity(), {
      id: 'footer-1',
      title: 'About',
      titleVi: 'Giới thiệu',
      url: '/about',
      sortOrder: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const domain = FooterMapper.toDomain(entity);
    expect(domain.sortOrder).toBe(5);
    expect(FooterMapper.toPersistence(domain).sortOrder).toBe(5);
  });

  it('should carry both column headings in each direction (#088)', () => {
    const entity = Object.assign(new FooterEntity(), {
      id: 'footer-2',
      title: 'Support',
      titleVi: 'Hỗ trợ',
      url: '/help-center',
      sortOrder: 1,
      categories: 'Support',
      categoriesVi: 'Hỗ trợ',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const domain = FooterMapper.toDomain(entity);
    expect(domain.categories).toBe('Support');
    expect(domain.categoriesVi).toBe('Hỗ trợ');

    const back = FooterMapper.toPersistence(domain);
    expect(back.categories).toBe('Support');
    expect(back.categoriesVi).toBe('Hỗ trợ');
  });

  it('should leave the Vietnamese heading unset rather than inventing one', () => {
    const entity = Object.assign(new FooterEntity(), {
      id: 'footer-3',
      title: 'Company',
      titleVi: 'Công ty',
      url: '/about',
      sortOrder: 0,
      categories: 'Company',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(FooterMapper.toDomain(entity).categoriesVi).toBeUndefined();
  });
});
