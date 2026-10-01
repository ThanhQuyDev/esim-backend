import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuSlideEntity } from '../entities/menu-slide.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { MenuSlide } from '../../../../domain/menu-slide';
import { MenuSlideRepository } from '../../menu-slide.repository';
import { MenuSlideMapper } from '../mappers/menu-slide.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class MenuSlideRelationalRepository implements MenuSlideRepository {
  constructor(
    @InjectRepository(MenuSlideEntity)
    private readonly menuSlideRepository: Repository<MenuSlideEntity>,
  ) {}

  async create(data: MenuSlide): Promise<MenuSlide> {
    const persistenceModel = MenuSlideMapper.toPersistence(data);
    const newEntity = await this.menuSlideRepository.save(
      this.menuSlideRepository.create(persistenceModel),
    );
    return MenuSlideMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
    lang,
    menuKey,
  }: {
    paginationOptions: IPaginationOptions;
    lang?: string;
    menuKey?: string;
  }): Promise<[MenuSlide[], number]> {
    const where: Record<string, unknown> = {};
    if (lang) {
      where.language = lang;
    }
    if (menuKey) {
      where.menuKey = menuKey;
    }

    const [entities, count] = await this.menuSlideRepository.findAndCount({
      where,
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      // The admin list is grouped the way the menu is, so panel and display order
      // come before recency.
      order: { menuKey: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' },
    });

    return [entities.map((entity) => MenuSlideMapper.toDomain(entity)), count];
  }

  async findActiveForMenus(lang?: string): Promise<MenuSlide[]> {
    const where: Record<string, unknown> = { isActive: true };
    if (lang) {
      where.language = lang;
    }

    const entities = await this.menuSlideRepository.find({
      where,
      order: { menuKey: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' },
    });

    return entities.map((entity) => MenuSlideMapper.toDomain(entity));
  }

  async findById(id: MenuSlide['id']): Promise<NullableType<MenuSlide>> {
    const entity = await this.menuSlideRepository.findOne({ where: { id } });
    return entity ? MenuSlideMapper.toDomain(entity) : null;
  }

  async update(
    id: MenuSlide['id'],
    payload: Partial<MenuSlide>,
  ): Promise<MenuSlide> {
    const entity = await this.menuSlideRepository.findOne({ where: { id } });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.menuSlideRepository.save(
      this.menuSlideRepository.create(
        MenuSlideMapper.toPersistence({
          ...MenuSlideMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return MenuSlideMapper.toDomain(updatedEntity);
  }

  async remove(id: MenuSlide['id']): Promise<void> {
    await this.menuSlideRepository.delete(id);
  }
}
