import { Repository } from 'typeorm';
import { FooterEntity } from '../entities/footer.entity';
import { FooterRelationalRepository } from './footer.repository';

/** #045 — the CMS footer list can be searched by column heading. */
describe('FooterRelationalRepository search', () => {
  function setup() {
    const qb = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const typeorm = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    } as unknown as Repository<FooterEntity>;
    return { qb, repository: new FooterRelationalRepository(typeorm) };
  }

  const paginationOptions = { page: 1, limit: 10 };

  it('should match the column heading in either language', async () => {
    const { qb, repository } = setup();

    await repository.findAllWithPagination({
      filterOptions: { category: ' Hỗ trợ ' },
      paginationOptions,
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      '(footer.categories ILIKE :category OR footer.categoriesVi ILIKE :category)',
      { category: '%Hỗ trợ%' },
    );
  });

  it('should not filter by heading when the search is blank', async () => {
    const { qb, repository } = setup();

    await repository.findAllWithPagination({
      filterOptions: { category: '   ' },
      paginationOptions,
    });

    expect(qb.andWhere).not.toHaveBeenCalled();
  });
});
