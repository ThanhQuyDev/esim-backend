import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { SupportedDeviceEntity } from '../entities/supported-device.entity';
import {
  SupportedDevice,
  DeviceType,
} from '../../../../domain/supported-device';
import { SupportedDeviceRepository } from '../../supported-device.repository';
import { SupportedDeviceMapper } from '../mappers/supported-device.mapper';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { compareDisplayOrder } from '../../../../supported-device-order';

@Injectable()
export class SupportedDeviceRelationalRepository implements SupportedDeviceRepository {
  constructor(
    @InjectRepository(SupportedDeviceEntity)
    private readonly repo: Repository<SupportedDeviceEntity>,
  ) {}

  async create(
    data: Omit<SupportedDevice, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SupportedDevice> {
    const newEntity = await this.repo.save(
      this.repo.create(
        SupportedDeviceMapper.toPersistence(data as SupportedDevice),
      ),
    );
    return SupportedDeviceMapper.toDomain(newEntity);
  }

  /**
   * Sorted in code, not SQL (#047): an unset position (0) must sort AFTER the
   * numbered ones, which a plain ORDER BY cannot say. The whole table is a few
   * hundred rows, so loading it and slicing the page is cheap.
   */
  private async findSorted(where: Record<string, unknown>) {
    const entities = await this.repo.find({ where });
    return entities
      .map(SupportedDeviceMapper.toDomain)
      .sort(compareDisplayOrder);
  }

  async findAllWithPagination({
    paginationOptions,
    type,
    search,
  }: {
    paginationOptions: IPaginationOptions;
    type?: DeviceType;
    search?: string;
  }): Promise<[SupportedDevice[], number]> {
    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (search) where.device = ILike(`%${search}%`);

    const sorted = await this.findSorted(where);
    const start = (paginationOptions.page - 1) * paginationOptions.limit;
    return [
      sorted.slice(start, start + paginationOptions.limit),
      sorted.length,
    ];
  }

  async findGrouped(search?: string): Promise<SupportedDevice[]> {
    const where: Record<string, unknown> = {};
    if (search) where.device = ILike(`%${search}%`);
    return this.findSorted(where);
  }

  async findById(
    id: SupportedDevice['id'],
  ): Promise<NullableType<SupportedDevice>> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? SupportedDeviceMapper.toDomain(entity) : null;
  }

  async update(
    id: SupportedDevice['id'],
    payload: Partial<SupportedDevice>,
  ): Promise<SupportedDevice> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new Error('Record not found');
    const updated = await this.repo.save(
      this.repo.create(
        SupportedDeviceMapper.toPersistence({
          ...SupportedDeviceMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );
    return SupportedDeviceMapper.toDomain(updated);
  }

  async setManufacturerOrder(
    manufacturer: string,
    manufacturerOrder: number,
  ): Promise<void> {
    await this.repo.update({ manufacturer }, { manufacturerOrder });
  }

  async findManufacturerOrder(
    manufacturer: string,
  ): Promise<number | undefined> {
    // Highest first, so one numbered row wins over any stray unset ones.
    const row = await this.repo.findOne({
      where: { manufacturer },
      order: { manufacturerOrder: 'DESC' },
    });
    return row?.manufacturerOrder;
  }

  async setSortOrders(
    items: { id: SupportedDevice['id']; sortOrder: number }[],
  ): Promise<void> {
    if (items.length === 0) return;
    await this.repo.manager.transaction(async (manager) => {
      for (const item of items) {
        await manager.update(
          SupportedDeviceEntity,
          { id: item.id },
          { sortOrder: item.sortOrder },
        );
      }
    });
  }

  async remove(id: SupportedDevice['id']): Promise<void> {
    await this.repo.delete(id);
  }
}
