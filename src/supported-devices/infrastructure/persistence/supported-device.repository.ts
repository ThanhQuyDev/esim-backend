import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { SupportedDevice, DeviceType } from '../../domain/supported-device';
import { DeepPartial } from '../../../utils/types/deep-partial.type';

export abstract class SupportedDeviceRepository {
  abstract create(
    data: Omit<SupportedDevice, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SupportedDevice>;

  abstract findAllWithPagination({
    paginationOptions,
    type,
    search,
  }: {
    paginationOptions: IPaginationOptions;
    type?: DeviceType;
    search?: string;
  }): Promise<[SupportedDevice[], number]>;

  abstract findGrouped(search?: string): Promise<SupportedDevice[]>;

  abstract findById(
    id: SupportedDevice['id'],
  ): Promise<NullableType<SupportedDevice>>;

  abstract update(
    id: SupportedDevice['id'],
    payload: DeepPartial<SupportedDevice>,
  ): Promise<SupportedDevice | null>;

  /** Apply one brand position to every device of that brand (#090). */
  abstract setManufacturerOrder(
    manufacturer: string,
    manufacturerOrder: number,
  ): Promise<void>;

  abstract remove(id: SupportedDevice['id']): Promise<void>;
}
