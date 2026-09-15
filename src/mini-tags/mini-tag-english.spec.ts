import { MiniTagsService } from './mini-tags.service';
import { MiniTagMapper } from './infrastructure/persistence/relational/mappers/mini-tag.mapper';
import { MiniTagEntity } from './infrastructure/persistence/relational/entities/mini-tag.entity';

/** #059 — blog mini tags get English copy for English posts. */
describe('mini tag English copy', () => {
  const english = {
    titleEn: 'Buy a travel eSIM at esim.vn',
    descriptionEn: 'Travel eSIMs for 200+ countries',
    contentButtonEn: 'See all destinations',
    linkUrlEn: 'https://esim.vn/en/destinations',
  };

  it('should save the English fields on create and update', async () => {
    const repository = {
      create: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      update: jest.fn().mockResolvedValue(null),
    };
    const service = new MiniTagsService(repository as never);

    await service.create({ title: 'Mua eSIM du lịch', ...english });
    await service.update('tag-1', { titleEn: 'New English title' });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining(english),
    );
    expect(repository.update).toHaveBeenCalledWith(
      'tag-1',
      expect.objectContaining({ titleEn: 'New English title' }),
    );
  });

  it('should carry the English fields through the mapper both ways', () => {
    const entity = Object.assign(new MiniTagEntity(), {
      id: 'tag-1',
      title: 'Mua eSIM du lịch',
      ...english,
    });

    const domain = MiniTagMapper.toDomain(entity);
    expect(domain).toMatchObject(english);
    expect(MiniTagMapper.toPersistence(domain)).toMatchObject(english);
  });

  it('should report missing English copy as null, for the Vietnamese fallback', () => {
    const domain = MiniTagMapper.toDomain(
      Object.assign(new MiniTagEntity(), {
        id: 'tag-2',
        title: 'Chỉ tiếng Việt',
      }),
    );

    expect(domain.titleEn).toBeNull();
    expect(domain.linkUrlEn).toBeNull();
  });
});
