import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ManufacturerNoteEntity } from '../entities/manufacturer-note.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { ManufacturerNote } from '../../../../domain/manufacturer-note';
import { ManufacturerNoteRepository } from '../../manufacturer-note.repository';
import { ManufacturerNoteMapper } from '../mappers/manufacturer-note.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class ManufacturerNoteRelationalRepository implements ManufacturerNoteRepository {
  constructor(
    @InjectRepository(ManufacturerNoteEntity)
    private readonly noteRepository: Repository<ManufacturerNoteEntity>,
  ) {}

  async create(data: ManufacturerNote): Promise<ManufacturerNote> {
    const persistenceModel = ManufacturerNoteMapper.toPersistence(data);
    const newEntity = await this.noteRepository.save(
      this.noteRepository.create(persistenceModel),
    );
    return ManufacturerNoteMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<[ManufacturerNote[], number]> {
    const [entities, count] = await this.noteRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      order: {
        manufacturer: 'ASC',
        language: 'ASC',
        sortOrder: 'ASC',
        createdAt: 'ASC',
      },
    });

    return [
      entities.map((entity) => ManufacturerNoteMapper.toDomain(entity)),
      count,
    ];
  }

  async findActive(): Promise<ManufacturerNote[]> {
    const entities = await this.noteRepository.find({
      where: { isActive: true },
      order: { manufacturer: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' },
    });

    return entities.map((entity) => ManufacturerNoteMapper.toDomain(entity));
  }

  async findById(
    id: ManufacturerNote['id'],
  ): Promise<NullableType<ManufacturerNote>> {
    const entity = await this.noteRepository.findOne({ where: { id } });
    return entity ? ManufacturerNoteMapper.toDomain(entity) : null;
  }

  async update(
    id: ManufacturerNote['id'],
    payload: Partial<ManufacturerNote>,
  ): Promise<ManufacturerNote> {
    const entity = await this.noteRepository.findOne({ where: { id } });

    if (!entity) {
      throw new Error('Record not found');
    }

    // A key left undefined means "not changing it": spread as-is, an edit that
    // did not send isActive switched a hidden note back on (vande #042).
    const changes = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined),
    ) as Partial<ManufacturerNote>;

    const updatedEntity = await this.noteRepository.save(
      this.noteRepository.create(
        ManufacturerNoteMapper.toPersistence({
          ...ManufacturerNoteMapper.toDomain(entity),
          ...changes,
        }),
      ),
    );

    return ManufacturerNoteMapper.toDomain(updatedEntity);
  }

  async remove(id: ManufacturerNote['id']): Promise<void> {
    await this.noteRepository.delete(id);
  }
}
