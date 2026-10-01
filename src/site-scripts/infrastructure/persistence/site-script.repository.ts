import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { SiteScript } from '../../domain/site-script';

export abstract class SiteScriptRepository {
  abstract create(
    data: Omit<SiteScript, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SiteScript>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<[SiteScript[], number]>;

  /** Active snippets in render order — what every page asks for. */
  abstract findActive(): Promise<SiteScript[]>;

  abstract findById(id: SiteScript['id']): Promise<NullableType<SiteScript>>;

  abstract update(
    id: SiteScript['id'],
    payload: DeepPartial<SiteScript>,
  ): Promise<SiteScript | null>;

  abstract remove(id: SiteScript['id']): Promise<void>;
}
