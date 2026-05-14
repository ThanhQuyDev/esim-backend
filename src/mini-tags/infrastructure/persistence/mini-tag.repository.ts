import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { MiniTag } from '../../domain/mini-tag';

export abstract class MiniTagRepository {
  abstract create(
    data: Omit<MiniTag, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MiniTag>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<[MiniTag[], number]>;

  abstract findById(id: MiniTag['id']): Promise<NullableType<MiniTag>>;

  abstract findByIds(ids: MiniTag['id'][]): Promise<MiniTag[]>;

  abstract update(
    id: MiniTag['id'],
    payload: DeepPartial<MiniTag>,
  ): Promise<MiniTag | null>;

  abstract remove(id: MiniTag['id']): Promise<void>;
}
