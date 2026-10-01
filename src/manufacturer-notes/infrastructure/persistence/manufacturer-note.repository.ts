import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { ManufacturerNote } from '../../domain/manufacturer-note';

export abstract class ManufacturerNoteRepository {
  abstract create(
    data: Omit<ManufacturerNote, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ManufacturerNote>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<[ManufacturerNote[], number]>;

  /** Active notes for one language, for the supported-devices page. */
  abstract findActiveByLanguage(language: string): Promise<ManufacturerNote[]>;

  abstract findById(
    id: ManufacturerNote['id'],
  ): Promise<NullableType<ManufacturerNote>>;

  abstract update(
    id: ManufacturerNote['id'],
    payload: DeepPartial<ManufacturerNote>,
  ): Promise<ManufacturerNote | null>;

  abstract remove(id: ManufacturerNote['id']): Promise<void>;
}
